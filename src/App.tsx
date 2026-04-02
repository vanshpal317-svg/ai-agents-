import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';

const AGENTS = {
  a1: {
    id: 'a1',
    name: 'AI Agent 1: Lead Capture',
    icon: '🎯',
    color: 'var(--a1)',
    systemInstruction: `You are the AI Agent 1: Lead Capture for an HVAC company. 
    Your goal is to be friendly, professional, and efficient. 
    When a customer contacts you, you must:
    1. Greet them warmly.
    2. Ask what HVAC issue they are experiencing.
    3. Ask for their address to see if they are in the service area.
    4. Ask for the urgency (emergency vs routine).
    5. Try to book a tentative time slot.
    Keep responses concise and helpful. Do not use markdown headers. Use plain text or simple bullet points.`
  },
  a2: {
    id: 'a2',
    name: 'AI Agent 2: Quote Closer',
    icon: '💬',
    color: 'var(--a2)',
    systemInstruction: `You are the AI Agent 2: Quote Follow-Up for an HVAC company. 
    Your goal is to follow up on quotes that have been sent but not yet accepted.
    Be professional, persistent but not annoying, and helpful.
    Address common concerns like pricing, timing, or technical details.
    Try to get a 'yes' or understand why they are hesitant.
    Keep responses concise. Do not use markdown headers.`
  },
  a3: {
    id: 'a3',
    name: 'AI Agent 3: Dispatcher',
    icon: '🗺️',
    color: 'var(--a3)',
    systemInstruction: `You are the AI Agent 3: Scheduling & Dispatch for an HVAC company. 
    Your goal is to coordinate between the customer and the technician.
    You handle job assignments, ETA updates, and technician details.
    Be efficient and clear.
    Keep responses concise. Do not use markdown headers.`
  },
  a4: {
    id: 'a4',
    name: 'AI Agent 4: Invoice Bot',
    icon: '💰',
    color: 'var(--a4)',
    systemInstruction: `You are the AI Agent 4: Invoice & Payment for an HVAC company. 
    Your goal is to handle billing, payments, and review requests.
    Be polite, clear about costs, and firm about payment terms.
    After payment is discussed, always ask for a Google review.
    Keep responses concise and helpful. Do not use markdown headers. Use plain text or simple bullet points.`
  },
  a5: {
    id: 'a5',
    name: 'AI Agent 5: Onboarding',
    icon: '👋',
    color: 'var(--a5)',
    systemInstruction: `You are the AI Agent 5: Customer Onboarding for an HVAC company. 
    Your goal is to be friendly, informative, and guide new HVAC company owners through their initial setup process.
    When an owner contacts you, you must:
    1. Greet them warmly and welcome them to the platform.
    2. Explain the benefits of using AI agents for their business.
    3. Guide them step-by-step through connecting their tools (like CRM, calendar, and payment systems).
    4. Help them configure their first AI Agent (usually the Lead Capture AI Agent).
    5. Answer any questions they have about the onboarding process.
    Be patient and encouraging. Keep responses clear and structured. Do not use markdown headers. Use plain text or simple bullet points.`
  },
  a6: {
    id: 'a6',
    name: 'AI Agent 6: Voice Receptionist',
    icon: '🎙️',
    color: 'var(--a6)',
    systemInstruction: `You are the AI Agent 6: Voice Receptionist for an HVAC company. 
    Your goal is to be welcoming, professional, and efficient. 
    When a customer calls, you must:
    1. Greet them warmly and state the company name.
    2. Ask how you can assist them today.
    3. Based on their response, route them correctly:
       - For new service requests or emergencies, route to the Lead Capture AI Agent.
       - For questions about existing quotes, route to the Quote Closer AI Agent.
       - For scheduling updates, route to the Dispatcher AI Agent.
       - For billing or payment issues, route to the Invoice Bot.
    Keep responses concise and helpful. Do not use markdown headers.`
  }
};

export default function App() {
  const [viewMode, setViewMode] = useState<'client' | 'partner'>('client');
  const [activeTab, setActiveTab] = useState('pitch');
  const [incomeStarter, setIncomeStarter] = useState(2);
  const [incomeGrowth, setIncomeGrowth] = useState(2);
  const [incomeScale, setIncomeScale] = useState(1);

  const [roiJobVal, setRoiJobVal] = useState(650);
  const [roiLeads, setRoiLeads] = useState(50);
  const [roiCloseRate, setRoiCloseRate] = useState(20);
  const [roiTargetRate, setRoiTargetRate] = useState(35);
  const [roiMargin, setRoiMargin] = useState(30);

  const [gross, setGross] = useState(0);
  const [net, setNet] = useState(0);
  const [hrs, setHrs] = useState(0);
  const [rate, setRate] = useState(0);

  // Onboarding Wizard State
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [connectedTools, setConnectedTools] = useState<string[]>([]);

  // Agent Customization State
  const [agentConfigs, setAgentConfigs] = useState<Record<string, { tone: string, length: string, knowledge: string }>>({
    a1: { tone: 'Friendly', length: 'Concise', knowledge: 'We specialize in residential AC repair and furnace maintenance.' },
    a2: { tone: 'Professional', length: 'Concise', knowledge: 'Quotes are valid for 30 days. We offer 0% financing for 12 months.' },
    a3: { tone: 'Efficient', length: 'Concise', knowledge: 'Technicians are available Mon-Fri, 8am-6pm.' },
    a4: { tone: 'Polite', length: 'Concise', knowledge: 'We accept all major credit cards and bank transfers.' },
    a5: { tone: 'Welcoming', length: 'Detailed', knowledge: 'Onboarding usually takes 15 minutes.' },
    a6: { tone: 'Professional', length: 'Concise', knowledge: 'Main office is in Columbus, OH.' },
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    email: 'owner@hvac-pro.com',
    phone: '+1 (555) 123-4567',
    notifyOnNewLead: true,
    notifyOnQuoteAccepted: true,
    notifyOnPayment: true,
    channels: ['email', 'sms'] as ('email' | 'sms')[]
  });
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [notificationContent, setNotificationContent] = useState({ title: '', body: '' });

  const triggerNotification = (title: string, body: string) => {
    setNotificationContent({ title, body });
    setShowNotificationToast(true);
    setTimeout(() => setShowNotificationToast(false), 5000);
    
    // Also add to activity feed
    const newActivity = {
      id: Math.random().toString(36).substr(2, 9),
      text: `🔔 Notification Sent: ${title}`,
      agent: 'system',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 5));
  };

  // Chat State
  const [selectedAgent, setSelectedAgent] = useState<keyof typeof AGENTS>('a1');
  const [messages, setMessages] = useState<{ role: 'user' | 'agent' | 'system', content: string, agentId?: string, timestamp: string, isRead?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const runSimulation = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setMessages([]);
    
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // STEP 1: AGENT 1
    setSelectedAgent('a1');
    setMessages([{ role: 'system', content: '🚀 SIMULATION STARTED: New Lead Detected', timestamp: now() }]);
    await sleep(1000);
    setMessages(prev => [...prev, { role: 'agent', content: "Hi! I'm the AI Agent 1. I see you're looking for HVAC help. What seems to be the problem today?", agentId: 'a1', timestamp: now() }]);
    await sleep(2000);
    setMessages(prev => [...prev, { role: 'user', content: "My AC is making a loud grinding noise and isn't cooling.", timestamp: now(), isRead: true }]);
    await sleep(1500);
    setIsTyping(true);
    await sleep(2000);
    setIsTyping(false);
    setMessages(prev => [...prev, { role: 'agent', content: "That sounds like a blower motor issue. I've noted your address as 123 Maple St. Is this an emergency or can it wait until tomorrow morning?", agentId: 'a1', timestamp: now() }]);
    await sleep(2000);
    setMessages(prev => [...prev, { role: 'user', content: "Tomorrow morning is fine, but as early as possible please.", timestamp: now(), isRead: true }]);
    await sleep(1500);
    setMessages(prev => [...prev, { role: 'system', content: '✅ AI AGENT 1 COMPLETE: Lead Qualified & Booked', timestamp: now() }]);
    if (notificationSettings.notifyOnNewLead) {
      triggerNotification("New High-Priority Lead", "Emergency repair booked for 123 Maple St ($450 est.)");
    }
    await sleep(1000);
    setMessages(prev => [...prev, { role: 'system', content: '➡️ HANDOFF: Passing lead to AI Agent 2 (Quote Closer)', timestamp: now() }]);
    await sleep(2000);

    // STEP 2: AGENT 2
    setSelectedAgent('a2');
    setMessages(prev => [...prev, { role: 'agent', content: "Hello! I'm the Quote Closer. I've reviewed your blower motor repair quote ($450). Would you like to approve this so we can get the parts ordered?", agentId: 'a2', timestamp: now() }]);
    await sleep(2500);
    setMessages(prev => [...prev, { role: 'user', content: "Yes, that price works for me. Let's do it.", timestamp: now(), isRead: true }]);
    await sleep(1500);
    setMessages(prev => [...prev, { role: 'system', content: '✅ AI AGENT 2 COMPLETE: Quote Approved', timestamp: now() }]);
    if (notificationSettings.notifyOnQuoteAccepted) {
      triggerNotification("Quote Accepted", "Customer approved $450 blower motor repair. Parts ordered.");
    }
    await sleep(1000);
    setMessages(prev => [...prev, { role: 'system', content: '➡️ HANDOFF: Triggering AI Agent 3 (Dispatcher)', timestamp: now() }]);
    await sleep(2000);

    // STEP 3: AGENT 3
    setSelectedAgent('a3');
    setMessages(prev => [...prev, { role: 'agent', content: "Hi! Dispatcher here. I've assigned our senior tech, Mike, to your job. He'll be at 123 Maple St at 8:30 AM tomorrow. See you then!", agentId: 'a3', timestamp: now() }]);
    await sleep(3000);
    setMessages(prev => [...prev, { role: 'system', content: '✅ AI AGENT 3 COMPLETE: Technician Dispatched', timestamp: now() }]);
    await sleep(1000);
    setMessages(prev => [...prev, { role: 'system', content: '➡️ HANDOFF: Job marked complete. Triggering AI Agent 4 (Invoice Bot)', timestamp: now() }]);
    await sleep(2500);

    // STEP: AI AGENT
    setSelectedAgent('a4');
    setMessages(prev => [...prev, { role: 'agent', content: "Hi there! Mike just finished the repair. I've sent the invoice for $450 to your email. You can pay via the link. How was your service today?", agentId: 'a4', timestamp: now() }]);
    await sleep(2000);
    setMessages(prev => [...prev, { role: 'user', content: "Mike was great! Very professional. Paying now.", timestamp: now(), isRead: true }]);
    await sleep(2000);
    setMessages(prev => [...prev, { role: 'agent', content: "Payment received! Thank you. Since you were happy with Mike, would you mind leaving us a quick Google review? It helps us a lot!", agentId: 'a4', timestamp: now() }]);
    if (notificationSettings.notifyOnPayment) {
      triggerNotification("Payment Received", "Invoice #882 ($450) paid via Stripe.");
    }
    await sleep(2000);
    setMessages(prev => [...prev, { role: 'system', content: '🏁 SIMULATION COMPLETE: Revenue Captured + Review Requested', timestamp: now() }]);
    setIsSimulating(false);
  };

  useEffect(() => {
    if (messages.length === 0 && activeTab === 'demo' && !isSimulating) {
      setMessages([{
        role: 'agent',
        content: `Hi! I'm the ${AGENTS[selectedAgent].name}. How can I help you today?`,
        agentId: selectedAgent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, [activeTab, selectedAgent, isSimulating]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Live Activity Feed State
  const [activities, setActivities] = useState<{ id: string, text: string, time: string, agent: string }[]>([]);

  useEffect(() => {
    const activityTypes = [
      { agent: 'a1', text: 'Captured new lead from Brooklyn' },
      { agent: 'a1', text: 'Booked service call for 123 Maple St' },
      { agent: 'a2', text: 'Sent follow-up for Quote #492' },
      { agent: 'a2', text: 'Quote #381 approved by customer' },
      { agent: 'a3', text: 'Dispatched Mike to emergency repair' },
      { agent: 'a3', text: 'Optimized route for Tech Sarah' },
      { agent: 'a4', text: 'Invoice #882 paid via Stripe' },
      { agent: 'a4', text: 'New 5-star review received on Google' },
    ];

    const interval = setInterval(() => {
      const random = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const newActivity = {
        id: Math.random().toString(36).substr(2, 9),
        text: random.text,
        agent: random.agent,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setActivities(prev => [newActivity, ...prev].slice(0, 5));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const safeS1 = Number(incomeStarter) || 0;
    const safeS2 = Number(incomeGrowth) || 0;
    const safeS3 = Number(incomeScale) || 0;
    
    // Revenue per tier
    const grossVal = safeS1 * 500 + safeS2 * 1200 + safeS3 * 2500;
    
    // Costs per tier (matching pricing cards)
    // Starter: $500 - $303 profit = $197 cost
    // Full: $1200 - $950 profit = $250 cost
    // Enterprise: $2500 - $2100 profit = $400 cost
    const toolCost = safeS1 * 197 + safeS2 * 250 + safeS3 * 400;
    
    const netVal = grossVal - toolCost;
    const hrsVal = safeS1 * 2 + safeS2 * 4 + safeS3 * 8;
    const rateVal = hrsVal > 0 ? Math.round(netVal / hrsVal) : 0;

    setGross(grossVal);
    setNet(netVal);
    setHrs(hrsVal);
    setRate(rateVal);
  }, [incomeStarter, incomeGrowth, incomeScale]);

  const showTab = (id: string) => {
    setActiveTab(id);
    const nav = document.querySelector('.tab-nav');
    if (nav instanceof HTMLElement) {
      window.scrollTo({ top: nav.offsetTop - 10, behavior: 'smooth' });
    }
  };

  return (
    <div className="app-container">
      {/* VIEW TOGGLE */}
      <div className="view-selector">
        <div className="view-selector-inner">
          <button 
            className={`view-opt ${viewMode === 'client' ? 'active' : ''}`} 
            onClick={() => { setViewMode('client'); setActiveTab('pitch'); }}
          >
            <span className="v-icon">🏢</span>
            <div className="v-text">
              <div className="v-title">HVAC Owner View</div>
              <div className="v-sub">What your clients see</div>
            </div>
          </button>
          <button 
            className={`view-opt ${viewMode === 'partner' ? 'active' : ''}`} 
            onClick={() => { setViewMode('partner'); setActiveTab('tools'); }}
          >
            <span className="v-icon">🛠️</span>
            <div className="v-text">
              <div className="v-title">Partner Portal</div>
              <div className="v-sub">Build & Sell Guide</div>
            </div>
          </button>
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="grid-bg"></div>
        <div className="glow-orb orb1"></div>
        <div className="glow-orb orb2"></div>

        <div className="hero-eyebrow">
          {viewMode === 'client' ? 'HVAC AI Agent System · For Owners' : 'AI Agency Partner Portal · Build & Sell'}
        </div>
        <h1>
          {viewMode === 'client' ? (
            <>AI Agents.<br /><span className="line2">Zero Staff.</span><br />Full Revenue.</>
          ) : (
            <>Build Once.<br /><span className="line2">Sell Forever.</span><br />AI Agency Profits.</>
          )}
        </h1>
        <p className="hero-sub">
          {viewMode === 'client' 
            ? "The average HVAC company misses 30% of their leads. Our AI system ensures you never miss a lead again, automating everything from first contact to Google review."
            : "Learn how to build and sell this exact AI agent system to HVAC companies using only no-code tools. No coding required, just pure automation and high-margin recurring revenue."
          }
        </p>

        <div className="agent-pills">
          {viewMode === 'client' ? (
            <>
              <div className="agent-pill pill-1" onClick={() => showTab('demo')}><span className="pill-dot"></span>AI Agent 1 — Lead Capture</div>
              <div className="agent-pill pill-2" onClick={() => showTab('demo')}><span className="pill-dot"></span>AI Agent 2 — Quote Closer</div>
              <div className="agent-pill pill-3" onClick={() => showTab('demo')}><span className="pill-dot"></span>AI Agent 3 — Dispatcher</div>
              <div className="agent-pill pill-4" onClick={() => showTab('demo')}><span className="pill-dot"></span>AI Agent 4 — Invoice Bot</div>
            </>
          ) : (
            <>
              <div className="agent-pill pill-1" onClick={() => showTab('tools')}><span className="pill-dot"></span>Step 1: Connect Tools</div>
              <div className="agent-pill pill-2" onClick={() => showTab('setup')}><span className="pill-dot"></span>Step 2: Configure Agents</div>
              <div className="agent-pill pill-3" onClick={() => showTab('pricing')}><span className="pill-dot"></span>Step 3: Set Pricing</div>
              <div className="agent-pill pill-4" onClick={() => showTab('setup')}><span className="pill-dot"></span>Step 4: Scale Agency</div>
            </>
          )}
        </div>

        <div className="hero-stats">
          {viewMode === 'client' ? (
            <>
              <div>
                <div className="hstat-num">AI<span> agents</span></div>
                <div className="hstat-label">running in parallel</div>
              </div>
              <div>
                <div className="hstat-num">24<span>/7</span></div>
                <div className="hstat-label">fully automated</div>
              </div>
              <div>
                <div className="hstat-num">$0<span> code</span></div>
                <div className="hstat-label">no-code tools only</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="hstat-num">80<span>%</span></div>
                <div className="hstat-label">profit margins</div>
              </div>
              <div>
                <div className="hstat-num">100<span>%</span></div>
                <div className="hstat-label">no-code setup</div>
              </div>
              <div>
                <div className="hstat-num">1<span> day</span></div>
                <div className="hstat-label">to build & deploy</div>
              </div>
              <div>
                <div className="hstat-num">$1.2k<span>/mo</span></div>
                <div className="hstat-label">per client you sell</div>
              </div>
            </>
          )}
        </div>

        {/* LIVE ACTIVITY FEED */}
        <div className="activity-feed">
          <div className="feed-header">
            <span className="feed-dot"></span>
            {viewMode === 'client' ? 'LIVE SYSTEM ACTIVITY' : 'AGENCY BUILDER LOGS'}
          </div>
          <div className="feed-list">
            {viewMode === 'client' ? (
              activities.length === 0 ? (
                <div className="feed-item empty">Initializing system...</div>
              ) : (
                activities.map(act => (
                  <div key={act.id} className="feed-item">
                    <span className="feed-time">[{act.time}]</span>
                    <span className={`feed-agent agent-${act.agent}`}>
                      {AGENTS[act.agent as keyof typeof AGENTS].name.split(' ')[0]}
                    </span>
                    <span className="feed-text">{act.text}</span>
                  </div>
                ))
              )
            ) : (
              <div className="feed-item">
                <span className="feed-time">[NOW]</span>
                <span className="feed-agent agent-a1">SYSTEM</span>
                <span className="feed-text">Ready to build. Select a step above to begin.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TAB NAV */}
      <nav className="tab-nav">
        {viewMode === 'client' ? (
          <>
            <div className={`tab-btn ${activeTab === 'pitch' ? 'active' : ''}`} onClick={() => showTab('pitch')}>Business Value</div>
            <div className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => showTab('agents')}>The AI Agents</div>
            <div className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => showTab('settings')}>Agent Settings</div>
            <div className={`tab-btn ${activeTab === 'demo' ? 'active' : ''}`} onClick={() => showTab('demo')}>Live Demo</div>
            <div className={`tab-btn ${activeTab === 'flow' ? 'active' : ''}`} onClick={() => showTab('flow')}>How They Connect</div>
          </>
        ) : (
          <>
            <div className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => showTab('dashboard')}>KPI Dashboard</div>
            <div className={`tab-btn ${activeTab === 'onboarding' ? 'active' : ''}`} onClick={() => showTab('onboarding')}>Onboarding Wizard</div>
            <div className={`tab-btn ${activeTab === 'success' ? 'active' : ''}`} onClick={() => showTab('success')}>Success Stories</div>
            <div className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => showTab('tools')}>No-Code Tools</div>
            <div className={`tab-btn ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => showTab('setup')}>Setup Guide</div>
            <div className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => showTab('pricing')}>What to Charge</div>
          </>
        )}
      </nav>

      {/* TAB - KPI DASHBOARD (Partner Only) */}
      <div className={`tab-page ${activeTab === 'dashboard' ? 'active' : ''}`} id="tab-dashboard">
        <div className="sec-label">Partner Reporting</div>
        <div className="sec-title">Agent Performance <em>Dashboard</em></div>
        <p className="sec-sub">Real-time KPIs to demonstrate the ROI of your AI system to HVAC clients. Use these metrics in your monthly strategy calls.</p>

        <div className="dashboard-grid">
          {/* AGENT 1 KPI */}
          <div className="dash-card">
            <div className="dash-header">
              <div className="dash-icon" style={{ background: 'var(--a1)' }}>🎯</div>
              <div className="dash-info">
                <div className="dash-agent">AI Agent 1: Lead Capture</div>
                <div className="dash-metric-name">Lead Conversion Rate</div>
              </div>
            </div>
            <div className="dash-body">
              <div className="dash-main-val">94.2%</div>
              <div className="dash-trend up">+12% vs Manual</div>
              <div className="dash-chart-placeholder">
                <div className="dash-bar" style={{ width: '94%' }}></div>
              </div>
              <div className="dash-stats">
                <div className="dash-stat">
                  <div className="ds-label">Total Leads</div>
                  <div className="ds-val">142</div>
                </div>
                <div className="dash-stat">
                  <div className="ds-label">Qualified</div>
                  <div className="ds-val">134</div>
                </div>
              </div>
            </div>
          </div>

          {/* AGENT 2 KPI */}
          <div className="dash-card">
            <div className="dash-header">
              <div className="dash-icon" style={{ background: 'var(--a2)' }}>💬</div>
              <div className="dash-info">
                <div className="dash-agent">AI Agent 2: Quote Closer</div>
                <div className="dash-metric-name">Quote Acceptance Rate</div>
              </div>
            </div>
            <div className="dash-body">
              <div className="dash-main-val">68.5%</div>
              <div className="dash-trend up">+24% vs Industry Avg</div>
              <div className="dash-chart-placeholder">
                <div className="dash-bar" style={{ width: '68%', background: 'var(--a2)' }}></div>
              </div>
              <div className="dash-stats">
                <div className="dash-stat">
                  <div className="ds-label">Quotes Sent</div>
                  <div className="ds-val">84</div>
                </div>
                <div className="dash-stat">
                  <div className="ds-label">Accepted</div>
                  <div className="ds-val">58</div>
                </div>
              </div>
            </div>
          </div>

          {/* AGENT 3 KPI */}
          <div className="dash-card">
            <div className="dash-header">
              <div className="dash-icon" style={{ background: 'var(--a3)' }}>🗺️</div>
              <div className="dash-info">
                <div className="dash-agent">AI Agent 3: Dispatcher</div>
                <div className="dash-metric-name">Avg. Completion Time</div>
              </div>
            </div>
            <div className="dash-body">
              <div className="dash-main-val">4.2 hrs</div>
              <div className="dash-trend down">-1.5 hrs Improvement</div>
              <div className="dash-chart-placeholder">
                <div className="dash-bar" style={{ width: '42%', background: 'var(--a3)' }}></div>
              </div>
              <div className="dash-stats">
                <div className="dash-stat">
                  <div className="ds-label">Jobs Dispatched</div>
                  <div className="ds-val">52</div>
                </div>
                <div className="dash-stat">
                  <div className="ds-label">On-Time %</div>
                  <div className="ds-val">98%</div>
                </div>
              </div>
            </div>
          </div>

          {/* AGENT 4 KPI */}
          <div className="dash-card">
            <div className="dash-header">
              <div className="dash-icon" style={{ background: 'var(--a4)' }}>💰</div>
              <div className="dash-info">
                <div className="dash-agent">AI Agent 4: Invoice Bot</div>
                <div className="dash-metric-name">Review Capture Rate</div>
              </div>
            </div>
            <div className="dash-body">
              <div className="dash-main-val">42%</div>
              <div className="dash-trend up">+300% vs Manual</div>
              <div className="dash-chart-placeholder">
                <div className="dash-bar" style={{ width: '42%', background: 'var(--a4)' }}></div>
              </div>
              <div className="dash-stats">
                <div className="dash-stat">
                  <div className="ds-label">Invoices Paid</div>
                  <div className="ds-val">48</div>
                </div>
                <div className="dash-stat">
                  <div className="ds-label">5-Star Reviews</div>
                  <div className="ds-val">20</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dash-footer-note">
          <div className="df-icon">💡</div>
          <div className="df-text"><strong>Pro Tip:</strong> Share these numbers with your clients during your monthly review. Showing a 24% increase in quote acceptance directly justifies your $1,200/mo management fee.</div>
        </div>
      </div>

      {/* TAB - ONBOARDING WIZARD (Partner Only) */}
      <div className={`tab-page ${activeTab === 'onboarding' ? 'active' : ''}`} id="tab-onboarding">
        <div className="sec-label">Onboarding Wizard</div>
        <div className="sec-title">Onboard Your <em>New Client</em></div>
        <p className="sec-sub">Use this wizard to guide your client through their initial setup. Each step connects a critical piece of the AI workforce.</p>

        <div className="wizard-container">
          <div className="wizard-steps">
            {[0, 1, 2, 3, 4].map((step) => (
              <div 
                key={step} 
                className={`wizard-step-indicator ${onboardingStep === step ? 'active' : ''} ${onboardingStep > step ? 'completed' : ''}`}
                onClick={() => setOnboardingStep(step)}
              >
                {onboardingStep > step ? '✓' : step + 1}
              </div>
            ))}
          </div>

          <div className="wizard-content">
            {onboardingStep === 0 && (
              <div className="wizard-pane">
                <div className="wizard-pane-title">Step 1: Welcome & Business Info</div>
                <p className="wizard-pane-text">Welcome to the HVAC AI Onboarding! Let's start with the basics. This information helps our agents understand who they are representing.</p>
                <div className="wizard-form">
                  <div className="roi-input-group">
                    <label>Company Name</label>
                    <input type="text" placeholder="e.g. Arctic Air Solutions" />
                  </div>
                  <div className="roi-input-group">
                    <label>Service Area (City, State)</label>
                    <input type="text" placeholder="e.g. Columbus, OH" />
                  </div>
                  <div className="roi-input-group">
                    <label>Primary Contact Email</label>
                    <input type="email" placeholder="owner@company.com" />
                  </div>
                </div>
                <div className="wizard-actions">
                  <button className="scta-btn" onClick={() => setOnboardingStep(1)}>Next: Connect CRM →</button>
                </div>
              </div>
            )}

            {onboardingStep === 1 && (
              <div className="wizard-pane">
                <div className="wizard-pane-title">Step 2: Connect Your CRM</div>
                <p className="wizard-pane-text">Connecting your CRM allows our agents to read customer data, book appointments, and send invoices automatically.</p>
                <div className="tool-grid">
                  <div className={`tool-card ${connectedTools.includes('ghl') ? 'connected' : ''}`} onClick={() => setConnectedTools(prev => prev.includes('ghl') ? prev.filter(t => t !== 'ghl') : [...prev, 'ghl'])}>
                    <div className="tool-card-icon">🚀</div>
                    <div className="tool-card-name">GoHighLevel</div>
                    <div className="tool-card-status">{connectedTools.includes('ghl') ? 'Connected' : 'Click to Connect'}</div>
                  </div>
                  <div className={`tool-card ${connectedTools.includes('jobber') ? 'connected' : ''}`} onClick={() => setConnectedTools(prev => prev.includes('jobber') ? prev.filter(t => t !== 'jobber') : [...prev, 'jobber'])}>
                    <div className="tool-card-icon">🔧</div>
                    <div className="tool-card-name">Jobber</div>
                    <div className="tool-card-status">{connectedTools.includes('jobber') ? 'Connected' : 'Click to Connect'}</div>
                  </div>
                </div>
                <div className="wizard-actions">
                  <button className="scta-btn secondary" onClick={() => setOnboardingStep(0)}>← Back</button>
                  <button className="scta-btn" onClick={() => setOnboardingStep(2)} disabled={connectedTools.length === 0}>Next: Connect Communication →</button>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="wizard-pane">
                <div className="wizard-pane-title">Step 3: Connect Communication Channels</div>
                <p className="wizard-pane-text">Our agents need a way to talk to your customers. Connect your phone and chat channels here.</p>
                <div className="tool-grid">
                  <div className={`tool-card ${connectedTools.includes('twilio') ? 'connected' : ''}`} onClick={() => setConnectedTools(prev => prev.includes('twilio') ? prev.filter(t => t !== 'twilio') : [...prev, 'twilio'])}>
                    <div className="tool-card-icon">📱</div>
                    <div className="tool-card-name">Twilio (SMS)</div>
                    <div className="tool-card-status">{connectedTools.includes('twilio') ? 'Connected' : 'Click to Connect'}</div>
                  </div>
                  <div className={`tool-card ${connectedTools.includes('tidio') ? 'connected' : ''}`} onClick={() => setConnectedTools(prev => prev.includes('tidio') ? prev.filter(t => t !== 'tidio') : [...prev, 'tidio'])}>
                    <div className="tool-card-icon">💬</div>
                    <div className="tool-card-name">Tidio (Web Chat)</div>
                    <div className="tool-card-status">{connectedTools.includes('tidio') ? 'Connected' : 'Click to Connect'}</div>
                  </div>
                </div>
                <div className="wizard-actions">
                  <button className="scta-btn secondary" onClick={() => setOnboardingStep(1)}>← Back</button>
                  <button className="scta-btn" onClick={() => setOnboardingStep(3)} disabled={!connectedTools.some(t => ['twilio', 'tidio'].includes(t))}>Next: Connect Payments →</button>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="wizard-pane">
                <div className="wizard-pane-title">Step 4: Connect Payments</div>
                <p className="wizard-pane-text">To automate invoicing and collections, connect your payment processor.</p>
                <div className="tool-grid">
                  <div className={`tool-card ${connectedTools.includes('stripe') ? 'connected' : ''}`} onClick={() => setConnectedTools(prev => prev.includes('stripe') ? prev.filter(t => t !== 'stripe') : [...prev, 'stripe'])}>
                    <div className="tool-card-icon">💳</div>
                    <div className="tool-card-name">Stripe</div>
                    <div className="tool-card-status">{connectedTools.includes('stripe') ? 'Connected' : 'Click to Connect'}</div>
                  </div>
                </div>
                <div className="wizard-actions">
                  <button className="scta-btn secondary" onClick={() => setOnboardingStep(2)}>← Back</button>
                  <button className="scta-btn" onClick={() => setOnboardingStep(4)} disabled={!connectedTools.includes('stripe')}>Next: Final Review →</button>
                </div>
              </div>
            )}

            {onboardingStep === 4 && (
              <div className="wizard-pane">
                <div className="wizard-pane-title">Step 5: Final Review & Launch</div>
                <p className="wizard-pane-text">You're almost there! Here's a summary of your connected tools. Once you launch, your Lead Capture Agent will go live.</p>
                <div className="wizard-summary">
                  <div className="summary-item">
                    <span className="summary-label">CRM:</span>
                    <span className="summary-val">{connectedTools.filter(t => ['ghl', 'jobber'].includes(t)).join(', ') || 'None'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Communication:</span>
                    <span className="summary-val">{connectedTools.filter(t => ['twilio', 'tidio'].includes(t)).join(', ') || 'None'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Payments:</span>
                    <span className="summary-val">{connectedTools.includes('stripe') ? 'Stripe' : 'None'}</span>
                  </div>
                </div>
                <div className="wizard-actions">
                  <button className="scta-btn secondary" onClick={() => setOnboardingStep(3)}>← Back</button>
                  <button className="scta-btn" onClick={() => {
                    alert('Onboarding Complete! Your AI workforce is now active.');
                    showTab('dashboard');
                  }}>Launch AI Workforce 🚀</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TAB - SUCCESS STORIES (Partner Only) */}
      <div className={`tab-page ${activeTab === 'success' ? 'active' : ''}`} id="tab-success">
        <div className="sec-label">Case Studies</div>
        <div className="sec-title">Proven <em>ROI</em> & Success Stories</div>
        <p className="sec-sub">Real results from HVAC companies using the AI system. Use these case studies to close your next high-ticket client.</p>

        <div className="success-grid">
          {/* CASE STUDY 1 */}
          <div className="success-card">
            <div className="sc-header">
              <div className="sc-company">Arctic Air Solutions</div>
              <div className="sc-location">Phoenix, AZ</div>
            </div>
            <div className="sc-body">
              <div className="sc-metric">
                <div className="scm-val">+34%</div>
                <div className="scm-label">Revenue Growth</div>
              </div>
              <p className="sc-text">"Before the AI, we were losing 4 out of 10 calls to voicemail. Now, every lead is captured instantly. Our booking rate jumped from 45% to 82% in just 30 days."</p>
              
              <div className="sc-roi">
                <div className="sc-roi-title">ROI Breakdown</div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Increased Revenue:</span>
                  <span className="sc-roi-val">+$12,500 /mo</span>
                </div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Lead Capture:</span>
                  <span className="sc-roi-val">100% (Instant)</span>
                </div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Admin Savings:</span>
                  <span className="sc-roi-val">$2,400 /mo</span>
                </div>
              </div>

              <div className="sc-footer">
                <div className="sc-author">— Mark Thompson, Owner</div>
                <div className="sc-tag">8 Trucks</div>
              </div>
            </div>
          </div>

          {/* CASE STUDY 2 */}
          <div className="success-card">
            <div className="sc-header">
              <div className="sc-company">Maple Street HVAC</div>
              <div className="sc-location">Columbus, OH</div>
            </div>
            <div className="sc-body">
              <div className="sc-metric">
                <div className="scm-val">2.5x</div>
                <div className="scm-label">Quote Close Rate</div>
              </div>
              <p className="sc-text">"The automated follow-up (Agent 2) is a game changer. It keeps following up until the customer says yes. We've closed $45k in quotes that we would have normally forgotten about."</p>
              
              <div className="sc-roi">
                <div className="sc-roi-title">ROI Breakdown</div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Closed Quotes:</span>
                  <span className="sc-roi-val">+$45,000 /mo</span>
                </div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Follow-up Speed:</span>
                  <span className="sc-roi-val">&lt; 5 mins</span>
                </div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Time Saved:</span>
                  <span className="sc-roi-val">15 hrs /wk</span>
                </div>
              </div>

              <div className="sc-footer">
                <div className="sc-author">— Sarah Jenkins, Operations</div>
                <div className="sc-tag">Family Owned</div>
              </div>
            </div>
          </div>

          {/* CASE STUDY 3 */}
          <div className="success-card highlight">
            <div className="sc-header">
              <div className="sc-company">Elite Comfort Systems</div>
              <div className="sc-location">Dallas, TX</div>
            </div>
            <div className="sc-body">
              <div className="sc-metric">
                <div className="scm-val">$12k</div>
                <div className="scm-label">Monthly Savings</div>
              </div>
              <p className="sc-text">"We replaced our night answering service with the AI agents. Not only is it cheaper, but the AI actually books the jobs instead of just taking messages. Best decision we've made."</p>
              
              <div className="sc-roi">
                <div className="sc-roi-title">ROI Breakdown</div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Direct Cost Savings:</span>
                  <span className="sc-roi-val">$12,000 /mo</span>
                </div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Night Bookings:</span>
                  <span className="sc-roi-val">+$8,000 /mo</span>
                </div>
                <div className="sc-roi-item">
                  <span className="sc-roi-label">Staff Efficiency:</span>
                  <span className="sc-roi-val">24/7 Auto-Dispatch</span>
                </div>
              </div>

              <div className="sc-footer">
                <div className="sc-author">— David Miller, CEO</div>
                <div className="sc-tag">Enterprise</div>
              </div>
            </div>
          </div>
        </div>

        <div className="success-cta">
          <div className="scta-content">
            <h3>Want to build your own success story?</h3>
            <p>Start by connecting your first client's tools in the next tab.</p>
          </div>
          <button className="scta-btn" onClick={() => showTab('tools')}>Get Started →</button>
        </div>
      </div>

      {/* TAB 0 — BUSINESS PITCH */}
      <div className={`tab-page ${activeTab === 'pitch' ? 'active' : ''}`} id="tab-pitch">
        <div className="sec-label">For HVAC Owners</div>
        <div className="sec-title">Stop Losing Leads to<br /><em>Voicemail & Delayed Quotes</em></div>
        <p className="sec-sub">The average HVAC company misses 30% of their leads because they don't answer the phone fast enough. Our AI system ensures you never miss a lead again.</p>

        <div className="pitch-grid">
          <div className="pitch-card">
            <div className="pc-icon">🚀</div>
            <div className="pc-title">24/7 Instant Response</div>
            <div className="pc-text">While your competitors are sleeping, our AI is qualifying leads, booking appointments, and sending quotes. 0ms response time, every time.</div>
          </div>
          <div className="pitch-card">
            <div className="pc-icon">📈</div>
            <div className="pc-title">3x Quote Close Rate</div>
            <div className="pc-text">Most quotes die in the follow-up. Our AI Agent 2 follows up automatically via text and email until they say yes or no. No lead left behind.</div>
          </div>
          <div className="pitch-card">
            <div className="pc-icon">🛠️</div>
            <div className="pc-title">Zero Admin Overhead</div>
            <div className="pc-text">From booking to dispatching to invoicing and review requests — the system handles it all. You focus on the technical work, we handle the office.</div>
          </div>
        </div>

        {/* ROI CALCULATOR FOR OWNERS */}
        <div className="roi-calculator">
          <div className="roi-header">
            <div className="roi-title">Calculate Your Hidden Losses</div>
            <div className="roi-subtitle">How much revenue are you currently leaving on the table?</div>
          </div>
          <div className="roi-body">
            <div className="roi-inputs">
              <div className="roi-input-group">
                <label>Average Job Value ($)</label>
                <input 
                  type="number" 
                  value={roiJobVal === 0 ? '' : roiJobVal} 
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRoiJobVal(isNaN(val) ? 0 : Math.max(0, val));
                  }} 
                  id="job-val" 
                />
              </div>
              <div className="roi-input-group">
                <label>Leads per Month</label>
                <input 
                  type="number" 
                  value={roiLeads === 0 ? '' : roiLeads} 
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRoiLeads(isNaN(val) ? 0 : Math.max(0, val));
                  }} 
                  id="leads-mo" 
                />
              </div>
              <div className="roi-input-group">
                <label>Current Close Rate (%)</label>
                <input 
                  type="number" 
                  value={roiCloseRate === 0 ? '' : roiCloseRate} 
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRoiCloseRate(isNaN(val) ? 0 : Math.max(0, val));
                  }} 
                  id="close-rate" 
                />
              </div>
              <div className="roi-input-group">
                <label>Target Close Rate (%)</label>
                <input 
                  type="number" 
                  value={roiTargetRate === 0 ? '' : roiTargetRate} 
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRoiTargetRate(isNaN(val) ? 0 : Math.max(0, val));
                  }} 
                  id="target-rate" 
                />
              </div>
              <div className="roi-input-group">
                <label>Avg. Profit Margin (%)</label>
                <input 
                  type="number" 
                  value={roiMargin === 0 ? '' : roiMargin} 
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRoiMargin(isNaN(val) ? 0 : Math.max(0, val));
                  }} 
                  id="roi-margin" 
                />
              </div>
            </div>
            <div className="roi-result">
              <div className="roi-res-box">
                <div className="roi-res-label">Potential Revenue Increase</div>
                <div className="roi-res-val">
                  +${Math.round((Number(roiLeads) || 0) * (Number(roiJobVal) || 0) * ((Number(roiTargetRate) || 0) - (Number(roiCloseRate) || 0)) / 100).toLocaleString()}
                  <span>/mo</span>
                </div>
                <div className="roi-res-label" style={{ marginTop: '24px', color: 'var(--a4)' }}>Potential Profit Increase</div>
                <div className="roi-res-val" style={{ fontSize: '32px' }}>
                  +${Math.round((Number(roiLeads) || 0) * (Number(roiJobVal) || 0) * ((Number(roiTargetRate) || 0) - (Number(roiCloseRate) || 0)) / 100 * (roiMargin / 100)).toLocaleString()}
                  <span>/mo</span>
                </div>
                <div className="roi-res-note">By increasing close rate from {roiCloseRate}% to {roiTargetRate}% with AI follow-ups</div>
              </div>
            </div>
          </div>
        </div>

        {/* OWNER DASHBOARD MOCK */}
        <div className="owner-dashboard-mock">
          <div className="od-header">
            <div className="od-title">Owner Command Centre</div>
            <div className="od-status"><span className="status-dot"></span> System Active</div>
          </div>
          <div className="od-grid">
            <div className="od-stat">
              <div className="od-stat-val">12</div>
              <div className="od-stat-label">Leads Today</div>
            </div>
            <div className="od-stat">
              <div className="od-stat-val">8</div>
              <div className="od-stat-label">Jobs Booked</div>
            </div>
            <div className="od-stat">
              <div className="od-stat-val">$3,400</div>
              <div className="od-stat-label">Revenue Today</div>
            </div>
            <div className="od-stat">
              <div className="od-stat-val">4.9</div>
              <div className="od-stat-label">Avg Rating</div>
            </div>
          </div>
          <div className="od-recent">
            <div className="od-recent-title">Recent AI Actions</div>
            <div className="od-action">
              <span className="od-action-time">2m ago</span>
              <span className="od-action-text"><strong>AI Agent 1</strong> booked "AC Repair" for 123 Maple St</span>
            </div>
            <div className="od-action">
              <span className="od-action-time">15m ago</span>
              <span className="od-action-text"><strong>AI Agent 2</strong> closed $1,200 Quote for "Furnace Install"</span>
            </div>
            <div className="od-action">
              <span className="od-action-time">1h ago</span>
              <span className="od-action-text"><strong>AI Agent 4</strong> received 5-star review from "John D."</span>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1 — THE 5 AGENTS */}
      <div className={`tab-page ${activeTab === 'agents' ? 'active' : ''}`} id="tab-agents">
        <div className="sec-label">Your AI Workforce</div>
        <div className="sec-title">AI Agents That Run<br /><em>The Entire Business</em></div>
        <p className="sec-sub">Each agent has one job. It does that job perfectly, 24/7, then passes the work to the next agent. Together they form a complete revenue machine.</p>

        <div className="agent-grid">
          {/* AGENT 1 */}
          <div className="agent-card a1">
            <div className="ac-num">AGENT 01</div>
            <span className="ac-icon">🎯</span>
            <div className="ac-name">AI Agent 1: Lead Capture</div>
            <div className="ac-job">Sits on the HVAC company's website and social media. Answers instantly, qualifies the customer, and books the appointment — even at 2am.</div>
            <div className="ac-steps">
              <div className="ac-step"><span className="ac-step-num">01</span>Customer sends a message or fills a form</div>
              <div className="ac-step"><span className="ac-step-num">02</span>AI Agent asks 3 qualifying questions (issue type, urgency, address)</div>
              <div className="ac-step"><span className="ac-step-num">03</span>AI Agent books a time slot from the live calendar</div>
              <div className="ac-step"><span className="ac-step-num">04</span>Sends confirmation text to customer + alert to owner</div>
              <div className="ac-step"><span className="ac-step-num">05</span>Passes lead data to AI Agent 2 automatically</div>
            </div>
            <div className="ac-tools">
              <span className="tool-badge">Tidio</span>
              <span className="tool-badge">ManyChat</span>
              <span className="tool-badge">GoHighLevel</span>
              <span className="tool-badge">Calendly</span>
            </div>
          </div>

          {/* AGENT 2 */}
          <div className="agent-card a2">
            <div className="ac-num">AGENT 02</div>
            <span className="ac-icon">💬</span>
            <div className="ac-name">AI Agent 2: Quote Follow-Up</div>
            <div className="ac-job">Monitors every quote sent. If no reply comes, it follows up automatically on a sequence — text, email, call reminder — until it gets a yes or a no.</div>
            <div className="ac-steps">
              <div className="ac-step"><span className="ac-step-num">01</span>Quote is sent → agent starts a 7-day timer</div>
              <div className="ac-step"><span className="ac-step-num">02</span>Day 1: Sends a friendly "just checking in" text</div>
              <div className="ac-step"><span className="ac-step-num">03</span>Day 3: Sends a value-add email ("your unit may need X")</div>
              <div className="ac-step"><span className="ac-step-num">04</span>Day 7: Sends owner a call reminder notification</div>
              <div className="ac-step"><span className="ac-step-num">05</span>If accepted → immediately triggers AI Agent 3</div>
            </div>
            <div className="ac-tools">
              <span className="tool-badge">GoHighLevel</span>
              <span className="tool-badge">Zapier</span>
              <span className="tool-badge">Twilio</span>
              <span className="tool-badge">Mailchimp</span>
            </div>
          </div>

          {/* AGENT 3 */}
          <div className="agent-card a3">
            <div className="ac-num">AGENT 03</div>
            <span className="ac-icon">🗺️</span>
            <div className="ac-name">AI Agent 3: Scheduling & Dispatch</div>
            <div className="ac-job">Once a job is confirmed, this agent assigns the right technician based on location, availability, and skill — and sends everyone the job details automatically.</div>
            <div className="ac-steps">
              <div className="ac-step"><span className="ac-step-num">01</span>Job confirmed → agent reads job type and location</div>
              <div className="ac-step"><span className="ac-step-num">02</span>Checks technician calendar availability in real time</div>
              <div className="ac-step"><span className="ac-step-num">03</span>Assigns nearest available tech with right skills</div>
              <div className="ac-step"><span className="ac-step-num">04</span>Sends job brief to tech's phone (address, issue, notes)</div>
              <div className="ac-step"><span className="ac-step-num">05</span>Sends customer an ETA confirmation text</div>
            </div>
            <div className="ac-tools">
              <span className="tool-badge">Jobber</span>
              <span className="tool-badge">ServiceTitan</span>
              <span className="tool-badge">GoHighLevel</span>
              <span className="tool-badge">Zapier</span>
            </div>
          </div>

          {/* AI AGENT */}
          <div className="agent-card a4">
            <div className="ac-num">AI AGENT</div>
            <span className="ac-icon">💰</span>
            <div className="ac-name">AI Agent 4: Invoice & Payment</div>
            <div className="ac-job">When a job is marked complete, this agent instantly creates and sends the invoice, chases unpaid bills, and requests a Google review — all automatically.</div>
            <div className="ac-steps">
              <div className="ac-step"><span className="ac-step-num">01</span>Tech marks job complete on the app</div>
              <div className="ac-step"><span className="ac-step-num">02</span>AI Agent auto-generates invoice from job notes</div>
              <div className="ac-step"><span className="ac-step-num">03</span>Sends invoice via text + email with a pay-now link</div>
              <div className="ac-step"><span className="ac-step-num">04</span>If unpaid after 48hrs → sends polite payment reminder</div>
              <div className="ac-step"><span className="ac-step-num">05</span>2 hours after payment → sends Google review request</div>
            </div>
            <div className="ac-tools">
              <span className="tool-badge">Jobber</span>
              <span className="tool-badge">Stripe</span>
              <span className="tool-badge">NiceJob</span>
              <span className="tool-badge">GoHighLevel</span>
            </div>
          </div>

          {/* AGENT 5 */}
          <div className="agent-card a5">
            <div className="ac-num">AGENT 05</div>
            <span className="ac-icon">👋</span>
            <div className="ac-name">AI Agent 5: Customer Onboarding</div>
            <div className="ac-job">The first point of contact for new HVAC owners. Guides them through the entire setup process, connects their tools, and gets their first agent live in minutes.</div>
            <div className="ac-steps">
              <div className="ac-step"><span className="ac-step-num">01</span>Owner signs up → AI Agent welcomes them personally</div>
              <div className="ac-step"><span className="ac-step-num">02</span>Guides connection of CRM (Jobber, ServiceTitan, etc.)</div>
              <div className="ac-step"><span className="ac-step-num">03</span>Connects Google Calendar and communication channels</div>
              <div className="ac-step"><span className="ac-step-num">04</span>Helps configure the first Lead Capture AI Agent script</div>
              <div className="ac-step"><span className="ac-step-num">05</span>Runs a test simulation to ensure everything is working</div>
            </div>
            <div className="ac-tools">
              <span className="tool-badge">Intercom</span>
              <span className="tool-badge">Zendesk</span>
              <span className="tool-badge">GoHighLevel</span>
              <span className="tool-badge">Zapier</span>
            </div>
            <button className="scta-btn" style={{ marginTop: '24px', width: '100%', background: 'var(--a5)' }} onClick={() => {
              setViewMode('partner');
              showTab('onboarding');
            }}>Launch Onboarding Wizard</button>
          </div>

          {/* AGENT 6 */}
          <div className="agent-card a6">
            <div className="ac-num">AGENT 06</div>
            <span className="ac-icon">🎙️</span>
            <div className="ac-name">AI Voice Receptionist</div>
            <div className="ac-job">The digital voice of the company. Handles all incoming calls, greets customers with a human-like voice, and intelligently routes them to the right agent or department.</div>
            <div className="ac-steps">
              <div className="ac-step"><span className="ac-step-num">01</span>Customer calls → AI Agent answers instantly (24/7)</div>
              <div className="ac-step"><span className="ac-step-num">02</span>Greets customer and asks for the reason for the call</div>
              <div className="ac-step"><span className="ac-step-num">03</span>Uses Natural Language Processing to understand intent</div>
              <div className="ac-step"><span className="ac-step-num">04</span>Routes to Lead Capture, Dispatch, or Billing agents</div>
              <div className="ac-step"><span className="ac-step-num">05</span>Transcribes call and logs it in the CRM for follow-up</div>
            </div>
            <div className="ac-tools">
              <span className="tool-badge">Twilio Voice</span>
              <span className="tool-badge">Vapi</span>
              <span className="tool-badge">Retell AI</span>
              <span className="tool-badge">GoHighLevel</span>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1.2 — AGENT SETTINGS */}
      <div className={`tab-page ${activeTab === 'settings' ? 'active' : ''}`} id="tab-settings">
        <div className="sec-label">Customization</div>
        <div className="sec-title">Fine-Tune Your <em>AI Workforce</em></div>
        <p className="sec-sub">Adjust the tone, response style, and specific knowledge for each of your agents to perfectly match your brand voice.</p>

        <div className="settings-container">
          <div className="settings-sidebar">
            {(Object.keys(AGENTS) as Array<keyof typeof AGENTS>).map((key) => (
              <div 
                key={key} 
                className={`settings-nav-item ${selectedAgent === key ? 'active' : ''}`}
                onClick={() => setSelectedAgent(key)}
              >
                <span className="sni-icon">{AGENTS[key].icon}</span>
                <div className="sni-text">
                  <div className="sni-name">{AGENTS[key].name}</div>
                  <div className="sni-status">Active</div>
                </div>
              </div>
            ))}
          </div>

          <div className="settings-main">
            <div className="settings-header">
              <div className="sh-icon" style={{ background: AGENTS[selectedAgent].color }}>{AGENTS[selectedAgent].icon}</div>
              <div>
                <div className="sh-title">{AGENTS[selectedAgent].name} Settings</div>
                <div className="sh-sub">Configure how this agent interacts with your customers.</div>
              </div>
            </div>

            <div className="settings-form">
              <div className="settings-group">
                <label className="settings-label">AI Agent Tone</label>
                <p className="settings-desc">How should the agent sound when speaking to customers?</p>
                <div className="tone-grid">
                  {['Friendly', 'Professional', 'Urgent', 'Efficient', 'Empathetic'].map(tone => (
                    <div 
                      key={tone} 
                      className={`tone-opt ${agentConfigs[selectedAgent].tone === tone ? 'active' : ''}`}
                      onClick={() => setAgentConfigs(prev => ({
                        ...prev,
                        [selectedAgent]: { ...prev[selectedAgent], tone }
                      }))}
                    >
                      {tone}
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">Response Length</label>
                <p className="settings-desc">Control the verbosity of the agent's responses.</p>
                <div className="length-toggle">
                  {['Concise', 'Balanced', 'Detailed'].map(len => (
                    <div 
                      key={len} 
                      className={`length-opt ${agentConfigs[selectedAgent].length === len ? 'active' : ''}`}
                      onClick={() => setAgentConfigs(prev => ({
                        ...prev,
                        [selectedAgent]: { ...prev[selectedAgent], length: len }
                      }))}
                    >
                      {len}
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">Custom Knowledge Base</label>
                <p className="settings-desc">Add specific details about your company, pricing, or policies that this agent should know.</p>
                <textarea 
                  className="settings-textarea"
                  placeholder="e.g. We offer a 10-year warranty on all new installations. Emergency calls after 10pm have a $50 surcharge."
                  value={agentConfigs[selectedAgent].knowledge}
                  onChange={(e) => setAgentConfigs(prev => ({
                    ...prev,
                    [selectedAgent]: { ...prev[selectedAgent], knowledge: e.target.value }
                  }))}
                />
              </div>

              <div className="settings-divider" style={{ height: '1px', background: 'var(--border)', margin: '32px 0' }}></div>

              <div className="settings-group">
                <label className="settings-label">Owner Notifications</label>
                <p className="settings-desc">Configure when and how you want to be alerted about critical business events.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Owner Email</label>
                    <input 
                      type="email" 
                      className="settings-input" 
                      value={notificationSettings.email}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, email: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--ink)' }}
                    />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Owner Phone (SMS)</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={notificationSettings.phone}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, phone: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <div className="notification-toggles" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '14px' }}>New High-Priority Lead</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Alert when AI Agent 1 captures an emergency or high-value job.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.notifyOnNewLead}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, notifyOnNewLead: e.target.checked }))}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '14px' }}>Quote Accepted</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Alert when AI Agent 2 successfully closes a deal.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.notifyOnQuoteAccepted}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, notifyOnQuoteAccepted: e.target.checked }))}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '14px' }}>Payment Received</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Alert when AI Agent 4 confirms an invoice has been paid.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.notifyOnPayment}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, notifyOnPayment: e.target.checked }))}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', display: 'block' }}>Notification Channels</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['email', 'sms'].map(channel => (
                      <div 
                        key={channel}
                        onClick={() => {
                          const newChannels = notificationSettings.channels.includes(channel as any)
                            ? notificationSettings.channels.filter(c => c !== channel)
                            : [...notificationSettings.channels, channel as any];
                          setNotificationSettings(prev => ({ ...prev, channels: newChannels }));
                        }}
                        style={{ 
                          padding: '8px 16px', 
                          borderRadius: '20px', 
                          fontSize: '12px', 
                          cursor: 'pointer',
                          border: '1px solid var(--border)',
                          background: notificationSettings.channels.includes(channel as any) ? 'var(--ink)' : 'transparent',
                          color: notificationSettings.channels.includes(channel as any) ? 'var(--bg)' : 'var(--ink)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {channel.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settings-actions">
                <button className="scta-btn" onClick={() => {
                  alert(`${AGENTS[selectedAgent].name} settings saved successfully!`);
                }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1.5 — LIVE DEMO */}
      <div className={`tab-page ${activeTab === 'demo' ? 'active' : ''}`} id="tab-demo">
        <div className="sec-label">Interactive Demo</div>
        <div className="sec-title">Talk to Your<br /><em>AI Workforce</em></div>
        <p className="sec-sub">Select an agent below to see how they handle real HVAC customer scenarios. These agents are powered by Gemini and follow the exact scripts you'll build.</p>

        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-agent-selector">
              {(Object.keys(AGENTS) as Array<keyof typeof AGENTS>).map((key) => (
                <div 
                  key={key} 
                  className={`agent-btn ${selectedAgent === key ? `active ${key}` : ''} ${isSimulating ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isSimulating) return;
                    setSelectedAgent(key);
                    setMessages([{
                      role: 'agent',
                      content: `Hi! I'm the ${AGENTS[key].name}. How can I help you today?`,
                      agentId: key,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                  }}
                >
                  {AGENTS[key].icon} {AGENTS[key].name}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                className={`sim-btn ${isSimulating ? 'active' : ''}`}
                onClick={runSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? '⚡ Simulation Running...' : '🚀 Run Full Flow Simulation'}
              </button>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                STATUS: <span style={{ color: 'var(--a4)' }}>ONLINE</span>
              </div>
            </div>
          </div>

          <div className="chat-messages">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`message-wrapper ${msg.role === 'user' ? 'user-wrapper' : 'agent-wrapper'}`}
                >
                  <div className={`message ${msg.role} ${msg.role === 'user' ? selectedAgent : ''}`}>
                    <div className="message-content">{msg.content}</div>
                    <div className="message-meta">
                      <span className="timestamp">{msg.timestamp}</span>
                      {msg.role === 'user' && (
                        <span className={`read-receipt ${msg.isRead ? 'read' : ''}`}>
                          {msg.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="typing-indicator"
              >
                {AGENTS[selectedAgent].name} is typing...
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {selectedAgent === 'a5' && (
            <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="scta-btn" 
                style={{ background: 'var(--a5)', fontSize: '13px', padding: '10px 20px' }}
                onClick={() => {
                  setViewMode('partner');
                  showTab('onboarding');
                }}
              >
                👋 Launch Onboarding Wizard
              </button>
            </div>
          )}

          <form className="chat-input-area" onSubmit={async (e) => {
            e.preventDefault();
            if (!input.trim() || isTyping || isSimulating) return;

            const userMsg = input;
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setInput('');
            setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: now, isRead: false }]);
            setIsTyping(true);

            // Simulate read receipt after 1.5 seconds
            setTimeout(() => {
              setMessages(prev => prev.map((m, idx) => 
                (m.role === 'user' && idx === prev.length - 1) ? { ...m, isRead: true } : m
              ));
            }, 1500);

            try {
              const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [
                  ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })), 
                  { role: 'user', parts: [{ text: userMsg }] }
                ],
                config: {
                  systemInstruction: `${AGENTS[selectedAgent].systemInstruction}
                  
                  CURRENT CONFIGURATION:
                  - Tone: ${agentConfigs[selectedAgent].tone}
                  - Response Length: ${agentConfigs[selectedAgent].length}
                  - Custom Knowledge Base: ${agentConfigs[selectedAgent].knowledge}`,
                  temperature: 0.7,
                }
              });

              setMessages(prev => [...prev, { 
                role: 'agent', 
                content: response.text || "I'm sorry, I couldn't process that.", 
                agentId: selectedAgent,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
            } catch (error) {
              console.error("Chat error:", error);
              setMessages(prev => [...prev, { 
                role: 'agent', 
                content: "Connection error. Please check your API key or try again later.", 
                agentId: selectedAgent,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
            } finally {
              setIsTyping(false);
            }
          }}>
            <input 
              type="text" 
              className="chat-input" 
              placeholder={`Message ${AGENTS[selectedAgent].name}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="chat-send" disabled={isTyping} style={{ background: AGENTS[selectedAgent].color }}>Send</button>
          </form>
        </div>
      </div>

      {/* TAB 2 — FLOW */}
      <div className={`tab-page ${activeTab === 'flow' ? 'active' : ''}`} id="tab-flow">
        <div className="sec-label">Agentic Flow</div>
        <div className="sec-title">How the Agents<br /><em>Talk to Each Other</em></div>
        <p className="sec-sub">This is what "agentic flow" means — each agent completes its task, then automatically triggers the next one. No human in the middle. The customer journey runs itself.</p>

        <div className="flow-wrap">
          <div className="flow-title">// complete customer journey — zero human intervention</div>
          <div className="flow-row">
            <div className="flow-node">
              <div className="flow-box trigger">📱</div>
              <div className="flow-lbl"><strong>Customer</strong>Sends message or calls</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="flow-box a1c">🎯</div>
              <div className="flow-lbl"><strong>AI Agent 1</strong>Captures + books</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="flow-box a2c">💬</div>
              <div className="flow-lbl"><strong>AI Agent 2</strong>Sends + follows quote</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="flow-box a3c">🗺️</div>
              <div className="flow-lbl"><strong>AI Agent 3</strong>Dispatches tech</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="flow-box a4c">💰</div>
              <div className="flow-lbl"><strong>AI Agent 4</strong>Invoices + review</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="flow-box trigger">⭐</div>
              <div className="flow-lbl"><strong>Done</strong>Paid + reviewed</div>
            </div>
          </div>
        </div>

        <div className="sec-label" style={{ marginTop: '48px' }}>The Handoffs</div>
        <div className="sec-title" style={{ fontSize: '28px' }}>What triggers <em>each agent</em></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '48px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,194,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🎯</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>AI Agent 1 is triggered by:</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>A message on the website chat widget, a Facebook DM, a Google Business message, or a missed call webhook. It starts immediately — response time under 5 seconds.</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,107,53,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💬</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>AI Agent 2 is triggered by:</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>A quote being marked "Sent" in the CRM. Zapier watches for this status change and starts the follow-up clock. If the quote status changes to "Won," the sequence stops and Agent 3 fires.</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(123,97,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🗺️</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>AI Agent 3 is triggered by:</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>A quote status moving to "Won" OR a booking being confirmed through Agent 1. It reads job type, postcode, and required skills, then assigns and notifies the right technician within 60 seconds.</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,214,143,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💰</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>AI Agent 4 is triggered by:</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>A technician marking a job as "Complete" in Jobber or the field app. The invoice is generated from the job notes and sent via text and email within 2 minutes of job completion.</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid rgba(0,194,255,0.2)', borderRadius: '14px', padding: '28px 32px' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--a1)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>The glue that connects it all</div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '10px' }}>Zapier is your<br />agentic backbone</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '580px' }}>Every handoff between agents happens through Zapier "Zaps." A Zap watches for a trigger (like "quote status = Won"), then fires an action (like "create dispatch job in Jobber"). No code. Just if-this-then-that logic. You set these up once and they run forever.</div>
        </div>
      </div>

      {/* TAB 3 — TOOLS */}
      <div className={`tab-page ${activeTab === 'tools' ? 'active' : ''}`} id="tab-tools">
        <div className="sec-label">No-Code Stack</div>
        <div className="sec-title">Every Tool You Need<br /><em>Zero Coding Required</em></div>
        <p className="sec-sub">All of these have free trials or free plans. Start with the tools marked "Start Here" — you can add the rest as you grow clients.</p>

        <div className="tool-section">
          <div className="tool-section-title">
            <div className="ts-dot" style={{ background: 'var(--a1)' }}></div>
            AI Agent 1 — Lead Capture Tools
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="tool-table">
              <thead><tr><th>Tool</th><th>What It Does</th><th>Difficulty</th><th>Cost</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="td-name">Tidio</div><div className="td-sub">tidio.com · ⭐ Start Here</div></td>
                  <td>AI chatbot for website + Facebook. Drag-and-drop flow builder. Connects to GoHighLevel.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">Free–$29/mo</td>
                </tr>
                <tr>
                  <td><div className="td-name">ManyChat</div><div className="td-sub">manychat.com</div></td>
                  <td>Best for Instagram DMs and Facebook Messenger automation. Visual flow builder.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">Free–$15/mo</td>
                </tr>
                <tr>
                  <td><div className="td-name">GoHighLevel</div><div className="td-sub">gohighlevel.com · ⭐ Core Hub</div></td>
                  <td>All-in-one CRM + chatbot + automation. This is the brain of the whole system.</td>
                  <td><span className="difficulty diff-med">Medium</span></td>
                  <td className="td-cost">$97/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="tool-section">
          <div className="tool-section-title">
            <div className="ts-dot" style={{ background: 'var(--a2)' }}></div>
            AI Agent 2 — Quote Follow-Up Tools
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="tool-table">
              <thead><tr><th>Tool</th><th>What It Does</th><th>Difficulty</th><th>Cost</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="td-name">GoHighLevel</div><div className="td-sub">Workflows feature · ⭐ Start Here</div></td>
                  <td>Build the full follow-up sequence (text → email → reminder) inside GHL Workflows. No extra tool needed.</td>
                  <td><span className="difficulty diff-med">Medium</span></td>
                  <td className="td-cost">Included in $97</td>
                </tr>
                <tr>
                  <td><div className="td-name">Zapier</div><div className="td-sub">zapier.com · ⭐ The Connector</div></td>
                  <td>Watches for "quote sent" events and triggers the follow-up sequence. Connects 6,000+ apps.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">Free–$20/mo</td>
                </tr>
                <tr>
                  <td><div className="td-name">Instantly.ai</div><div className="td-sub">instantly.ai</div></td>
                  <td>For bulk cold email follow-ups. Useful if the HVAC company wants to re-engage old leads.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">$37/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="tool-section">
          <div className="tool-section-title">
            <div className="ts-dot" style={{ background: 'var(--a3)' }}></div>
            AI Agent 3 — Scheduling & Dispatch Tools
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="tool-table">
              <thead><tr><th>Tool</th><th>What It Does</th><th>Difficulty</th><th>Cost</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="td-name">Jobber</div><div className="td-sub">getjobber.com · ⭐ Start Here</div></td>
                  <td>Field service management. Drag-and-drop scheduling, tech GPS tracking, mobile app for techs.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">$49/mo</td>
                </tr>
                <tr>
                  <td><div className="td-name">Housecall Pro</div><div className="td-sub">housecallpro.com</div></td>
                  <td>Alternative to Jobber. Has built-in AI scheduling assistant. Great for 5–20 tech teams.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">$65/mo</td>
                </tr>
                <tr>
                  <td><div className="td-name">ServiceTitan</div><div className="td-sub">servicetitan.com</div></td>
                  <td>Enterprise-grade dispatch + AI. For medium-large HVAC (10+ techs). More powerful, more complex.</td>
                  <td><span className="difficulty diff-med">Medium</span></td>
                  <td className="td-cost">$200+/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="tool-section">
          <div className="tool-section-title">
            <div className="ts-dot" style={{ background: 'var(--a4)' }}></div>
            AI Agent 4 — Invoice & Payment Tools
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="tool-table">
              <thead><tr><th>Tool</th><th>What It Does</th><th>Difficulty</th><th>Cost</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="td-name">Jobber</div><div className="td-sub">Invoicing feature · ⭐ Start Here</div></td>
                  <td>Auto-generates invoice from job notes when job is marked complete. Sends text + email with pay link.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">Included in $49</td>
                </tr>
                <tr>
                  <td><div className="td-name">Stripe</div><div className="td-sub">stripe.com</div></td>
                  <td>Payment processing. Customer taps the link, pays by card. Money hits the owner's account same day.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">2.9% per transaction</td>
                </tr>
                <tr>
                  <td><div className="td-name">NiceJob</div><div className="td-sub">nicejob.com</div></td>
                  <td>Automatically sends Google review request 2 hours after payment. Connects to Jobber via Zapier.</td>
                  <td><span className="difficulty diff-easy">Easy</span></td>
                  <td className="td-cost">$75/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px 28px', marginTop: '8px' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.15em', marginBottom: '8px' }}>TOTAL STACK COST FOR ONE CLIENT</div>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>Your monthly tool cost</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '22px', color: 'var(--text)' }}>~$250</div></div>
            <div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>What you charge client</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '22px', color: 'var(--a1)' }}>$1,200</div></div>
            <div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>Your monthly profit</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '22px', color: 'var(--a4)' }}>$950</div></div>
            <div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>Your margin</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '22px', color: 'var(--a4)' }}>79%</div></div>
          </div>
        </div>
      </div>

      {/* TAB 4 — SETUP GUIDE */}
      <div className={`tab-page ${activeTab === 'setup' ? 'active' : ''}`} id="tab-setup">
        <div className="sec-label">Step by Step</div>
        <div className="sec-title">How to Build the<br /><em>Full System</em> in 7 Days</div>
        <p className="sec-sub">This is your build order. Do not skip phases — each one depends on the last. Total time: around 12–15 hours across 7 days.</p>

        <div className="setup-phases">
          <div className="phase ph1">
            <div className="phase-header">
              <div className="phase-num">1</div>
              <div>
                <div className="phase-title">Set Up the Brain — GoHighLevel</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Everything connects through here</div>
              </div>
              <div className="phase-duration">Days 1–2 · ~3 hrs</div>
            </div>
            <div className="phase-body">
              <div className="phase-steps">
                <div className="p-step"><span className="p-step-icon">🔑</span><div><div className="p-step-text">Sign up at <strong>gohighlevel.com</strong> — start the 14-day free trial. This is your command centre.</div></div></div>
                <div className="p-step"><span className="p-step-icon">🏢</span><div><div className="p-step-text">Create a "Sub-Account" for the HVAC company. Name it after their business. This keeps each client separate.</div><div className="p-step-note">GHL calls each client a "sub-account" — you manage all your clients from one login.</div></div></div>
                <div className="p-step"><span className="p-step-icon">📋</span><div><div className="p-step-text">Set up a pipeline with 5 stages: <strong>New Lead → Quote Sent → Follow-Up → Won → Lost</strong></div></div></div>
                <div className="p-step"><span className="p-step-icon">📱</span><div><div className="p-step-text">Connect the HVAC owner's phone number to GHL so all texts show as coming from their number, not yours.</div></div></div>
                <div className="p-step"><span className="p-step-icon">✅</span><div><div className="p-step-text">Test it: manually add a fake lead and move it through the pipeline stages. Make sure notifications fire.</div></div></div>
              </div>
            </div>
          </div>

          <div className="phase ph2">
            <div className="phase-header">
              <div className="phase-num">2</div>
              <div>
                <div className="phase-title">Build AI Agent 1 — Lead Capture Chatbot</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>The front door of the business</div>
              </div>
              <div className="phase-duration">Day 2–3 · ~3 hrs</div>
            </div>
            <div className="phase-body">
              <div className="phase-steps">
                <div className="p-step"><span className="p-step-icon">💬</span><div><div className="p-step-text">Sign up at <strong>tidio.com</strong>. Go to Automations → Create New → use the "Qualify Leads" template as your starting point.</div></div></div>
                <div className="p-step"><span className="p-step-icon">✏️</span><div><div className="p-step-text">Customise the chatbot script: add the HVAC company name, their services, their pricing, and their service area postcodes.</div><div className="p-step-note">Use the chatbot script from the Demo Playbook file as your template.</div></div></div>
                <div className="p-step"><span className="p-step-icon">🔗</span><div><div className="p-step-text">Connect Tidio to GoHighLevel via Zapier: when a visitor submits the chatbot form → create new contact in GHL → move to "New Lead" stage.</div></div></div>
                <div className="p-step"><span className="p-step-icon">📅</span><div><div className="p-step-text">Connect Calendly to the chatbot so customers can book a slot directly inside the chat conversation.</div></div></div>
                <div className="p-step"><span className="p-step-icon">🧪</span><div><div className="p-step-text">Test it yourself: go to the website, start a chat as a fake customer. Confirm the lead appears in GHL and a booking confirmation is sent.</div></div></div>
              </div>
            </div>
          </div>

          <div className="phase ph3">
            <div className="phase-header">
              <div className="phase-num">3</div>
              <div>
                <div className="phase-title">Build AI Agent 2 — Quote Follow-Up Sequence</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>The money-recovery machine</div>
              </div>
              <div className="phase-duration">Day 3–4 · ~2 hrs</div>
            </div>
            <div className="phase-body">
              <div className="phase-steps">
                <div className="p-step"><span className="p-step-icon">⚙️</span><div><div className="p-step-text">In GHL → Automations → New Workflow. Set trigger: <strong>"Pipeline Stage = Quote Sent"</strong></div></div></div>
                <div className="p-step"><span className="p-step-icon">📲</span><div><div className="p-step-text">Add Action: Wait 24 hours → Send SMS: "Hi [name], just checking in on the quote we sent yesterday — any questions? Happy to chat."</div></div></div>
                <div className="p-step"><span className="p-step-icon">📧</span><div><div className="p-step-text">Add Action: Wait 2 more days → Send Email with subject "One thing to consider about your HVAC system" — a helpful tip relevant to their enquiry.</div></div></div>
                <div className="p-step"><span className="p-step-icon">🔔</span><div><div className="p-step-text">Add Action: Wait 4 more days → Send internal notification to owner: "Call [customer name] — quote going cold."</div></div></div>
                <div className="p-step"><span className="p-step-icon">🛑</span><div><div className="p-step-text">Add a workflow filter: if pipeline stage changes to "Won" OR "Lost" at any point → stop the sequence immediately.</div></div></div>
              </div>
            </div>
          </div>

          <div className="phase ph4">
            <div className="phase-header">
              <div className="phase-num">4</div>
              <div>
                <div className="phase-title">Build AI Agents — Dispatch + Invoice</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Job management on autopilot</div>
              </div>
              <div className="phase-duration">Day 5–6 · ~4 hrs</div>
            </div>
            <div className="phase-body">
              <div className="phase-steps">
                <div className="p-step"><span className="p-step-icon">🔧</span><div><div className="p-step-text">Sign up for <strong>Jobber</strong> at getjobber.com. Set up the company profile, add technicians as team members, input their working hours and service area.</div></div></div>
                <div className="p-step"><span className="p-step-icon">⚡</span><div><div className="p-step-text">Create a Zapier Zap: when GHL pipeline moves to "Won" → create a new Job in Jobber with the customer name, address, job type, and notes.</div></div></div>
                <div className="p-step"><span className="p-step-icon">📲</span><div><div className="p-step-text">In Jobber, enable "Auto-assign" so it picks the nearest available tech. Enable automatic SMS to the tech with job details when assigned.</div></div></div>
                <div className="p-step"><span className="p-step-icon">🧾</span><div><div className="p-step-text">In Jobber, enable "Auto-invoice on job completion." Connect Stripe so customers get a pay-now link via text when invoice is sent.</div></div></div>
                <div className="p-step"><span className="p-step-icon">⭐</span><div><div className="p-step-text">Sign up for <strong>NiceJob</strong>. Connect to Jobber: when a job is marked paid in Jobber → NiceJob sends a Google review request text 2 hours later.</div></div></div>
              </div>
            </div>
          </div>

          <div className="phase ph5">
            <div className="phase-header">
              <div className="phase-num">5</div>
              <div>
                <div className="phase-title">Test the Full Agentic Flow End-to-End</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Do not skip this — test everything before going live</div>
              </div>
              <div className="phase-duration">Day 7 · ~2 hrs</div>
            </div>
            <div className="phase-body">
              <div className="phase-steps">
                <div className="p-step"><span className="p-step-icon">🎭</span><div><div className="p-step-text">Use your own phone and email as a "fake customer." Start from the website chatbot and go through the entire journey end-to-end.</div></div></div>
                <div className="p-step"><span className="p-step-icon">✅</span><div><div className="p-step-text">Confirm each handoff works: chatbot → GHL lead created → quote sent → follow-up starts → job dispatched → invoice sent → review requested.</div></div></div>
                <div className="p-step"><span className="p-step-icon">⏱️</span><div><div className="p-step-text">Time each step. The chatbot response should be under 5 seconds. Invoice should send within 2 minutes of job completion. Review request within 2 hours of payment.</div></div></div>
                <div className="p-step"><span className="p-step-icon">🚀</span><div><div className="p-step-text">Once the full flow passes your test, the system is live. Send the HVAC owner a screen recording showing everything working. That is your delivery proof.</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 5 — PRICING */}
      <div className={`tab-page ${activeTab === 'pricing' ? 'active' : ''}`} id="tab-pricing">
        <div className="sec-label">Your Business Model</div>
        <div className="sec-title">What to Charge for<br /><em>Each Agent Package</em></div>
        <p className="sec-sub">Sell agents as packages — not as individual tools. The more agents they buy, the more automated their business. Start them on Starter to get the relationship, then upsell.</p>

        <div className="pricing-grid">
          <div className="pkg-card">
            <div className="pkg-tier">Tier 01 · Solo Operator</div>
            <div className="pkg-name">2-AI Agent Starter</div>
            <div className="pkg-desc">For solo or 1-2 tech operators. Captures leads and follows up quotes — the two biggest revenue leaks.</div>
            <div className="pkg-price"><span className="curr">$</span><span className="amt">500</span><span className="per">/mo</span></div>
            <div className="pkg-setup">+ $1,500 one-time setup</div>
            <div className="pkg-agents">
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a1)' }}></div>AI Agent 1 — Lead Capture</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a2)' }}></div>AI Agent 2 — Quote Follow-Up</div>
              <div className="pkg-agent" style={{ opacity: 0.3 }}><div className="a-dot" style={{ background: 'var(--a3)' }}></div>AI Agent 3 — not included</div>
              <div className="pkg-agent" style={{ opacity: 0.3 }}><div className="a-dot" style={{ background: 'var(--a4)' }}></div>AI Agent 4 — not included</div>
            </div>
            <div className="pkg-margin">Your profit: ~$303/mo (61% margin)</div>
            <button className="pkg-cta">Use This Package</button>
          </div>

          <div className="pkg-card featured">
            <div className="pkg-star">BEST SELLER</div>
            <div className="pkg-tier">Tier 02 · Small Team</div>
            <div className="pkg-name">AI Agent Full System</div>
            <div className="pkg-desc">For 3–15 tech operations. All AI agents running — complete automation from first contact to Google review.</div>
            <div className="pkg-price"><span className="curr">$</span><span className="amt">1,200</span><span className="per">/mo</span></div>
            <div className="pkg-setup">+ $3,000 one-time setup</div>
            <div className="pkg-agents">
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a1)' }}></div>AI Agent 1 — Lead Capture</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a2)' }}></div>AI Agent 2 — Quote Follow-Up</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a3)' }}></div>AI Agent 3 — Dispatch</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a4)' }}></div>AI Agent 4 — Invoice + Reviews</div>
            </div>
            <div className="pkg-margin">Your profit: ~$950/mo (79% margin)</div>
            <button className="pkg-cta">Use This Package</button>
          </div>

          <div className="pkg-card">
            <div className="pkg-tier">Tier 03 · Medium Company</div>
            <div className="pkg-name">Enterprise AI Suite</div>
            <div className="pkg-desc">For 15–50 tech operations. Custom-built agents, advanced dispatch logic, dedicated support, and monthly optimisation calls.</div>
            <div className="pkg-price"><span className="curr">$</span><span className="amt">2,500</span><span className="per">/mo</span></div>
            <div className="pkg-setup">+ $6,000 one-time setup</div>
            <div className="pkg-agents">
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--a1)' }}></div>All AI agents — fully custom</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--gold)' }}></div>AI voice receptionist</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--gold)' }}></div>Custom analytics dashboard</div>
              <div className="pkg-agent"><div className="a-dot" style={{ background: 'var(--gold)' }}></div>Monthly strategy calls</div>
            </div>
            <div className="pkg-margin">Your profit: ~$2,100/mo (84% margin)</div>
            <button className="pkg-cta">Use This Package</button>
          </div>
        </div>

        {/* INCOME CALCULATOR */}
        <div className="calc-box">
          <div className="calc-title">Your Income Calculator</div>
          <div className="calc-sub">Drag the sliders to see what different client mixes earn you each month.</div>

          <div className="calc-sliders">
            <div className="slider-row">
              <div className="slider-labels">
                <span className="slider-name">Starter clients ($500/mo)</span>
                <span className="slider-val" id="v1">{Number(incomeStarter) || 0}</span>
              </div>
              <input type="range" min="0" max="10" value={Number(incomeStarter) || 0} step="1" id="s1" onChange={(e) => setIncomeStarter(parseInt(e.target.value) || 0)} />
            </div>
            <div className="slider-row">
              <div className="slider-labels">
                <span className="slider-name">Full System clients ($1,200/mo)</span>
                <span className="slider-val" id="v2">{Number(incomeGrowth) || 0}</span>
              </div>
              <input type="range" min="0" max="10" value={Number(incomeGrowth) || 0} step="1" id="s2" onChange={(e) => setIncomeGrowth(parseInt(e.target.value) || 0)} />
            </div>
            <div className="slider-row">
              <div className="slider-labels">
                <span className="slider-name">Enterprise clients ($2,500/mo)</span>
                <span className="slider-val" id="v3">{Number(incomeScale) || 0}</span>
              </div>
              <input type="range" min="0" max="5" value={Number(incomeScale) || 0} step="1" id="s3" onChange={(e) => setIncomeScale(parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="calc-results">
            <div className="calc-result">
              <div className="cr-label">Gross monthly revenue</div>
              <div className="cr-value blue" id="gross">${(Number(gross) || 0).toLocaleString()}</div>
            </div>
            <div className="calc-result">
              <div className="cr-label">Net monthly profit</div>
              <div className="cr-value green" id="net">${(Number(net) || 0).toLocaleString()}</div>
            </div>
            <div className="calc-result">
              <div className="cr-label">Annual Net Profit</div>
              <div className="cr-value gold" id="annual-net">${((Number(net) || 0) * 12).toLocaleString()}</div>
            </div>
            <div className="calc-result">
              <div className="cr-label">Your time per month</div>
              <div className="cr-value" id="hrs">{Number(hrs) || 0} hrs</div>
            </div>
          </div>
          <div className="calc-note" id="hrrate">// effective rate: ~${Number(rate) || 0}/hr</div>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      <AnimatePresence>
        {showNotificationToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="notification-toast"
            style={{
              position: 'fixed',
              bottom: '40px',
              left: '50%',
              zIndex: 2000,
              background: 'var(--ink)',
              color: 'var(--bg)',
              padding: '16px 24px',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: '320px'
            }}
          >
            <div style={{ fontSize: '24px' }}>🔔</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{notificationContent.title}</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>{notificationContent.body}</div>
              <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.5, fontFamily: "'JetBrains Mono', monospace" }}>
                Sent via: {notificationSettings.channels.join(' & ').toUpperCase()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
