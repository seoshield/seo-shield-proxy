import { Page } from 'puppeteer';
import { SeoProtocolConfig } from '../config';

/**
 * Shadow DOM configuration
 */
export interface ShadowDOMConfig {
  enabled: boolean;
  deepSerialization: boolean;
  includeShadowContent: boolean;
  flattenShadowTrees: boolean;
  customElements: Record<string, {
    extractMethod: 'slot' | 'attribute' | 'custom';
    selector?: string;
    attribute?: string;
  }>;
  preserveShadowBoundaries: boolean;
  extractCSSVariables: boolean;
  extractComputedStyles: boolean;
}

/**
 * Extracted shadow content information
 */
export interface ExtractedContent {
  lightDOM: string;
  shadowDOMs: Array<{
    host: string;
    hostSelector: string;
    content: string;
    slots: string[];
    cssVariables: Record<string, string>;
    styles: string;
  }>;
  flattened: string;
  stats: {
    totalShadowRoots: number;
    extractedElements: number;
    cssVariables: number;
    nestedDepth: number;
    extractionTime: number;
  };
  warnings: string[];
}

/**
 * Shadow DOM and Web Components penetration utilities
 *
 * Advanced DOM traversal that penetrates Shadow DOM boundaries and extracts
 * content from Web Components for complete SEO content extraction.
 */
export class ShadowDOMExtractor {
  private config: ShadowDOMConfig;

  constructor(config: ShadowDOMConfig) {
    this.config = config;
  }

  /**
   * Extract complete content including Shadow DOM
   */
  async extractCompleteContent(page: Page): Promise<ExtractedContent> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      const html = await page.content();
      return {
        lightDOM: html,
        shadowDOMs: [],
        flattened: html,
        stats: {
          totalShadowRoots: 0,
          extractedElements: 0,
          cssVariables: 0,
          nestedDepth: 0,
          extractionTime: Date.now() - startTime,
        },
        warnings: ['Shadow DOM extraction is disabled'],
      };
    }

    console.log('🔍 Starting Shadow DOM content extraction...');

    try {
      const extractionScript = this.getExtractionScript();
      const result = await page.evaluate(extractionScript, this.config);

      // Post-process results
      const extractedContent: ExtractedContent = {
        lightDOM: result.lightDOM,
        shadowDOMs: result.shadowDOMs || [],
        flattened: result.flattened || result.lightDOM,
        stats: {
          totalShadowRoots: result.shadowDOMs?.length || 0,
          extractedElements: result.extractedElements || 0,
          cssVariables: result.cssVariables?.length || 0,
          nestedDepth: result.maxDepth || 0,
          extractionTime: Date.now() - startTime,
        },
        warnings: result.warnings || [],
      };

      // Log extraction results
      this.logExtractionResults(extractedContent);

      return extractedContent;

    } catch (error) {
      console.error('❌ Shadow DOM extraction failed:', error);
      const html = await page.content();

      return {
        lightDOM: html,
        shadowDOMs: [],
        flattened: html,
        stats: {
          totalShadowRoots: 0,
          extractedElements: 0,
          cssVariables: 0,
          nestedDepth: 0,
          extractionTime: Date.now() - startTime,
        },
        warnings: [`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Get the JavaScript extraction script
   */
  private getExtractionScript(): string {
    return `
    (function(config) {
      const result = {
        lightDOM: '',
        shadowDOMs: [],
        flattened: '',
        extractedElements: 0,
        cssVariables: [],
        maxDepth: 0,
        warnings: []
      };

      try {
        // Get the original HTML
        result.lightDOM = document.documentElement.outerHTML;
        result.flattened = result.lightDOM;

        if (!config.enabled) {
          result.warnings.push('Shadow DOM extraction is disabled');
          return result;
        }

        // Extract content from all shadow roots
        const shadowContents = extractShadowContent(document.documentElement, 0);
        result.shadowDOMs = shadowContents.shadowDOMs;
        result.extractedElements = shadowContents.extractedElements;
        result.cssVariables = shadowContents.cssVariables;
        result.maxDepth = shadowContents.maxDepth;

        // Create flattened version if requested
        if (config.flattenShadowTrees) {
          result.flattened = createFlattenedHTML(document.documentElement, shadowContents);
        }

        return result;

      } catch (error) {
        result.warnings.push('Extraction script error: ' + error.message);
        return result;
      }

      // Recursive function to extract shadow content
      function extractShadowContent(element, depth) {
        const shadowDOMs = [];
        let extractedElements = 0;
        const cssVariables = [];
        let maxDepth = depth;

        // Check if element has a shadow root
        if (element.shadowRoot) {
          const shadowRoot = element.shadowRoot;
          const hostInfo = getElementInfo(element);

          const shadowContent = {
            host: hostInfo.tagName,
            hostSelector: generateSelector(element),
            content: '',
            slots: [],
            cssVariables: {},
            styles: ''
          };

          try {
            // Extract CSS variables if requested
            if (config.extractCSSVariables) {
              const computedStyle = window.getComputedStyle(element);
              for (let i = 0; i < computedStyle.length; i++) {
                const property = computedStyle[i];
                if (property.startsWith('--')) {
                  shadowContent.cssVariables[property] = computedStyle.getPropertyValue(property);
                  cssVariables.push(property);
                }
              }
            }

            // Extract styles if requested
            if (config.extractComputedStyles) {
              const styleSheets = Array.from(shadowRoot.styleSheets || []);
              shadowContent.styles = styleSheets.map(sheet => {
                try {
                  return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\\n');
                } catch (e) {
                  return '';
                }
              }).join('\\n');
            }

            // Find and extract slots
            const slots = shadowRoot.querySelectorAll('slot');
            shadowContent.slots = Array.from(slots).map(slot => {
              const name = slot.getAttribute('name') || 'default';
              const assignedNodes = slot.assignedNodes();
              const content = Array.from(assignedNodes).map(node =>
                node.nodeType === Node.TEXT_NODE ? node.textContent : node.outerHTML
              ).filter(Boolean).join('');
              return { name, content };
            });

            // Clone the shadow root content
            const clonedContent = shadowRoot.cloneNode(true);
            shadowContent.content = clonedContent.innerHTML;

            shadowDOMs.push(shadowContent);
            extractedElements++;
            maxDepth = Math.max(maxDepth, depth);

          } catch (error) {
            console.warn('Failed to extract from shadow root:', error.message);
          }
        }

        // Process child elements
        if (config.deepSerialization) {
          for (const child of element.children) {
            const childResult = extractShadowContent(child, depth + 1);
            shadowDOMs.push(...childResult.shadowDOMs);
            extractedElements += childResult.extractedElements;
            cssVariables.push(...childResult.cssVariables);
            maxDepth = Math.max(maxDepth, childResult.maxDepth);
          }
        }

        return {
          shadowDOMs,
          extractedElements,
          cssVariables,
          maxDepth
        };
      }

      // Get element information
      function getElementInfo(element) {
        return {
          tagName: element.tagName.toLowerCase(),
          id: element.id,
          className: element.className,
          attributes: Array.from(element.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
          }))
        };
      }

      // Generate CSS selector for element
      function generateSelector(element) {
        if (element.id) {
          return '#' + element.id;
        }

        const path = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let selector = current.nodeName.toLowerCase();
          if (current.className) {
            selector += '.' + current.className.split(' ').join('.');
          }
          path.unshift(selector);
          current = current.parentNode;
        }

        return path.join(' > ');
      }

      // Create flattened HTML with shadow content
      function createFlattenedHTML(rootElement, shadowContents) {
        const container = document.createElement('div');
        container.innerHTML = rootElement.outerHTML;

        // Replace shadow hosts with their flattened content
        const shadowHosts = container.querySelectorAll('*');
        shadowHosts.forEach(host => {
          const hostSelector = generateSelector(host);
          const shadowInfo = shadowContents.shadowDOMs.find(shadow =>
            shadow.hostSelector === hostSelector
          );

          if (shadowInfo && config.includeShadowContent) {
            if (config.flattenShadowTrees) {
              // Replace element with flattened content
              const flattenedDiv = document.createElement('div');
              flattenedDiv.innerHTML = shadowInfo.content;

              // Preserve original attributes
              Array.from(host.attributes).forEach(attr => {
                flattenedDiv.setAttribute(attr.name, attr.value);
              });

              host.parentNode.replaceChild(flattenedDiv, host);
            } else {
              // Add shadow content as comment or data attribute
              host.setAttribute('data-shadow-content', shadowInfo.content);
            }
          }
        });

        return container.innerHTML;
      }

    })(arguments[0]);
    `;
  }

  /**
   * Extract content from specific custom elements
   */
  async extractCustomElementContent(page: Page, tagName: string): Promise<string[]> {
    if (!this.config.customElements[tagName]) {
      console.warn(`No extraction configuration found for custom element: ${tagName}`);
      return [];
    }

    const elementConfig = this.config.customElements[tagName];

    const extractionScript = `
    (function(tagName, config) {
      const elements = document.querySelectorAll(tagName);
      const contents = [];

      elements.forEach(element => {
        let content = '';

        try {
          switch (config.extractMethod) {
            case 'slot':
              const slots = element.querySelectorAll('slot');
              content = Array.from(slots).map(slot => {
                const name = slot.getAttribute('name') || 'default';
                const assignedNodes = slot.assignedNodes();
                const slotContent = Array.from(assignedNodes).map(node =>
                  node.nodeType === Node.TEXT_NODE ? node.textContent : node.outerHTML
                ).filter(Boolean).join('');
                return slotContent;
              }).join('');
              break;

            case 'attribute':
              if (config.attribute) {
                content = element.getAttribute(config.attribute) || '';
              }
              break;

            case 'custom':
              if (config.selector) {
                const targetElements = element.querySelectorAll(config.selector);
                content = Array.from(targetElements).map(el => el.outerHTML).join('');
              }
              break;
          }

          if (content) {
            contents.push(content);
          }

        } catch (error) {
          console.warn('Failed to extract from custom element:', error.message);
        }
      });

      return contents;
    })(arguments[0], arguments[1]);
    `;

    return await page.evaluate(extractionScript, tagName, elementConfig);
  }

  /**
   * Get CSS variables from shadow DOM
   */
  async getShadowCSSVariables(page: Page): Promise<Record<string, string>> {
    const script = `
    () => {
      const variables = {};
      const allElements = document.querySelectorAll('*');

      allElements.forEach(element => {
        if (element.shadowRoot) {
          const computedStyle = window.getComputedStyle(element);
          for (let i = 0; i < computedStyle.length; i++) {
            const property = computedStyle[i];
            if (property.startsWith('--')) {
              variables[property] = computedStyle.getPropertyValue(property);
            }
          }
        }
      });

      return variables;
    }
    `;

    return await page.evaluate(script);
  }

  /**
   * Check if page uses Shadow DOM or Web Components
   */
  async hasShadowDOM(page: Page): Promise<boolean> {
    const script = `
    () => {
      return !!document.querySelector('*') &&
             Array.from(document.querySelectorAll('*')).some(el => el.shadowRoot);
    }
    `;

    return await page.evaluate(script);
  }

  /**
   * Get statistics about Shadow DOM usage
   */
  async getShadowDOMStats(page: Page): Promise<{
    totalElements: number;
    shadowHosts: number;
    openShadowRoots: number;
    closedShadowRoots: number;
    customElements: string[];
  }> {
    const script = `
    () => {
      const allElements = document.querySelectorAll('*');
      const shadowHosts = Array.from(allElements).filter(el => el.shadowRoot);
      const customElements = [...new Set(shadowHosts.map(el => el.tagName.toLowerCase()))];

      let openShadowRoots = 0;
      let closedShadowRoots = 0;

      shadowHosts.forEach(host => {
        try {
          // Try to access shadowRoot - if it's closed, this will throw
          if (host.shadowRoot) {
            openShadowRoots++;
          }
        } catch (e) {
          closedShadowRoots++;
        }
      });

      return {
        totalElements: allElements.length,
        shadowHosts: shadowHosts.length,
        openShadowRoots,
        closedShadowRoots,
        customElements
      };
    }
    `;

    return await page.evaluate(script);
  }

  /**
   * Log extraction results for monitoring
   */
  private logExtractionResults(result: ExtractedContent): void {
    console.log('🔍 Shadow DOM Extraction Results:');
    console.log(`   Total shadow roots: ${result.stats.totalShadowRoots}`);
    console.log(`   Extracted elements: ${result.stats.extractedElements}`);
    console.log(`   CSS variables: ${result.stats.cssVariables}`);
    console.log(`   Max depth: ${result.stats.nestedDepth}`);
    console.log(`   Extraction time: ${result.stats.extractionTime}ms`);

    if (result.shadowDOMs.length > 0) {
      console.log(`   Shadow hosts found: ${result.shadowDOMs.map(s => s.host).join(', ')}`);
    }

    if (result.warnings.length > 0) {
      console.log(`   Warnings: ${result.warnings.length}`);
      result.warnings.forEach(warning => {
        console.log(`   ⚠️  ${warning}`);
      });
    }
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): ShadowDOMConfig {
    return {
      enabled: true,
      deepSerialization: true,
      includeShadowContent: true,
      flattenShadowTrees: true,
      customElements: {
        'lit-element': {
          extractMethod: 'slot'
        },
        'stencil-component': {
          extractMethod: 'slot'
        },
        'custom-element': {
          extractMethod: 'custom',
          selector: '.content'
        }
      },
      preserveShadowBoundaries: false,
      extractCSSVariables: true,
      extractComputedStyles: false,
    };
  }
}