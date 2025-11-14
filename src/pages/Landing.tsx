import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BarChart, Zap, Shield, ChevronRight } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: "Advanced AI Pipeline",
      description: "Sophisticated multi-step analysis powered by cutting-edge machine learning algorithms"
    },
    {
      icon: BarChart,
      title: "Intelligent Analysis",
      description: "Deep product analysis with comprehensive vendor comparison and scoring"
    },
    {
      icon: Zap,
      title: "Real-time Processing",
      description: "Lightning-fast requirement validation and instant product recommendations"
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with consistent, accurate results you can trust"
    }
  ];

  const productTypes = [
    "Pressure Transmitter",
    "Temperature Transmitter",
    "Humidity Transmitter",
    "Flow Meter",
    "Level Transmitter",
    "pH Sensors"
  ];

  return (
    <div className="min-h-screen app-gradient text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-white/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* <img src="/ChatGPT Image Nov 11, 2025, 11_58_30 AM.png" alt="Logo" className="w-10 h-10 rounded-full object-cover" />
            <span className="text-xl font-bold">Controls Systems Recommender</span> */}
          </div>
          <div className="flex items-center space-x-4">
            <button className="btn-secondary px-4 py-2" onClick={() => navigate('/login')}>Login</button>
            <button className="btn-primary px-4 py-2" onClick={() => navigate('/signup')}>Sign Up</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6 py-24 text-center">
          <div className="w-24 h-24 mx-auto mb-8">
            <img src="/ChatGPT Image Nov 11, 2025, 11_58_30 AM.png" alt="Logo" className="w-full h-full rounded-full object-cover shadow-md" />
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
            Welcome to{' '}
            <span className="text-gradient inline-block">
              EnGenie
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Intelligent product matching powered by an advanced AI pipeline. Describe your product requirements and get personalized recommendations with comprehensive vendor analysis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-primary px-6 py-3 text-base inline-flex items-center justify-center" onClick={() => navigate('/signup')}>
              Get Started
              <ChevronRight className="ml-2 w-4 h-4" />
            </button>
            <button className="btn-secondary px-6 py-3 text-base" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-gradient inline-block">
              Powerful AI-Driven Features
            </h2>
            <p className="text-lg text-muted-foreground">
              Experience the next generation of product recommendation technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="surface-card p-6 group hover:scale-105 transition-transform duration-300"
              >
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center shadow-sm" style={{background: 'var(--gradient-primary)'}}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                </div>
                <div>
                  <p className="text-muted-foreground text-center">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Types Section */}
      <section className="py-24 bg-secondary">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Supported Product Categories</h2>
          <p className="text-lg text-muted-foreground mb-10">
            Comprehensive analysis across various industrial sensor types
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {productTypes.map((type, index) => (
              <div
                key={index}
                className="rounded-lg p-4 font-medium bg-white border hover:scale-105 transition-all"
                style={{borderColor: 'hsl(var(--border))', boxShadow: 'var(--shadow-card)'}}
              >
                {type}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 text-center">
        <div className="surface-card p-12 max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-gradient inline-block">
            Ready to Find Your Perfect Product?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of engineers who trust our EnGenie. Product type detection will start automatically upon entering your requirements.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-primary px-6 py-3 inline-flex items-center justify-center" onClick={() => navigate('/signup')}>
              Create Account
              <ChevronRight className="ml-2 w-4 h-4" />
            </button>
            <button className="btn-secondary px-6 py-3" onClick={() => navigate('/login')}>
              I Already Have an Account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-muted-foreground text-sm text-center">
        © 2024 EnGenie. Powered by advanced AI pipeline.
      </footer>
    </div>
  );
};

export default Landing;
