import React from 'react';
import './Homepage.css';

const Homepage = () => {
  return (
    <div className="homepage">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to MyApp</h1>
          <p className="hero-description">
            Your one-stop solution for amazing web experiences. 
            Build, create, and innovate with our powerful platform.
          </p>
          <button className="cta-button">Get Started</button>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="section-title">Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>Fast & Reliable</h3>
              <p>Lightning-fast performance with 99.9% uptime guarantee.</p>
            </div>
            <div className="feature-card">
              <h3>Easy to Use</h3>
              <p>Intuitive interface designed for users of all skill levels.</p>
            </div>
            <div className="feature-card">
              <h3>Secure</h3>
              <p>Enterprise-grade security to keep your data safe.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-preview">
        <div className="container">
          <h2 className="section-title">About Us</h2>
          <p className="about-text">
            We are passionate about creating innovative solutions that help 
            businesses grow and succeed in the digital world. Our team of 
            experts is dedicated to delivering exceptional results.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Homepage;