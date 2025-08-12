import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Homepage from './components/Homepage';
import EditFabric from './components/EditFabric';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/edit-fabric" element={<EditFabric />} />
            <Route path="/about" element={<div className="page">About Page</div>} />
            <Route path="/services" element={<div className="page">Services Page</div>} />
            <Route path="/contact" element={<div className="page">Contact Page</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
