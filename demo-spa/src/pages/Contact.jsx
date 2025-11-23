import { Helmet } from 'react-helmet-async';

export default function Contact() {
  return (
    <>
      <Helmet>
        <title>Contact Us - SEO Demo SPA</title>
        <meta name="description" content="Get in touch with the SEO Shield Proxy team" />
        <meta property="og:title" content="Contact Us - SEO Demo SPA" />
      </Helmet>

      <div className="page-container">
        <h1>📧 Contact Us</h1>
        <p className="page-subtitle">We'd love to hear from you</p>

        <div className="contact-grid">
          <div className="contact-info">
            <h2>Get in Touch</h2>
            <div className="contact-item">
              <strong>📧 Email:</strong>
              <p>support@seoshield.example</p>
            </div>
            <div className="contact-item">
              <strong>💬 Discord:</strong>
              <p>discord.gg/seoshield</p>
            </div>
            <div className="contact-item">
              <strong>🐙 GitHub:</strong>
              <p>github.com/seoshield</p>
            </div>
            <div className="contact-item">
              <strong>🐦 Twitter:</strong>
              <p>@seoshield</p>
            </div>
          </div>

          <div className="contact-form">
            <h2>Send a Message</h2>
            <form>
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="Your name" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="your@email.com" />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea rows="5" placeholder="Your message..."></textarea>
              </div>
              <button type="submit" className="submit-btn">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
