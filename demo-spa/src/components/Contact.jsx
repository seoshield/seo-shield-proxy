import React, { useState } from "react"
import { Helmet } from "react-helmet-async"

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log("Form submitted:", formData)
    alert("Thank you for your message! We will get back to you soon.")
    setFormData({ name: "", email: "", subject: "", message: "" })
  }

  return (
    <>
      <Helmet>
        <title>Contact SEO Shield Proxy - Get in Touch</title>
        <meta name="description" content="Contact SEO Shield Proxy team - Ask questions, request demos, or get technical support for your SPA SEO optimization needs" />
        <meta name="keywords" content="contact, support, demo, SEO Shield Proxy, help" />
        <link rel="canonical" href="http://localhost:3000/contact" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "name": "Contact SEO Shield Proxy",
            "description": "Get in touch with the SEO Shield Proxy team",
            "url": "http://localhost:3000/contact",
            "mainEntity": {
              "@type": "Organization",
              "name": "SEO Shield Proxy",
              "url": "http://localhost:3000",
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service"
              }
            }
          })}
        </script>
      </Helmet>

      <div className="content-section">
        <h1>Contact Us</h1>
        <p>Have questions about SEO Shield Proxy? We are here to help!</p>

        <div className="content-section">
          <h2>Get in Touch</h2>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem"}}>
            <div>
              <h3>General Inquiries</h3>
              <p>Email: info@seo-shield-proxy.com</p>
              <p>Response time: Within 24 hours</p>
            </div>
            <div>
              <h3>Technical Support</h3>
              <p>Email: support@seo-shield-proxy.com</p>
              <p>Response time: Within 12 hours</p>
            </div>
          </div>
        </div>

        <div className="content-section">
          <h2>Send us a Message</h2>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
              />
            </div>
            
            <button type="submit" className="btn">Send Message</button>
          </form>
        </div>

        <div className="content-section">
          <h2>Request a Demo</h2>
          <p>
            Want to see SEO Shield Proxy in action? Schedule a personalized demo with our team. 
            We will show you how our solution can transform your SPA application.
          </p>
          <button className="btn">Schedule Demo</button>
        </div>
      </div>
    </>
  )
}

export default Contact
