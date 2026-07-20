import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquare, Slack, CheckCircle, Zap, Shield, GitMerge, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      toast({
        title: "Missing fields",
        description: "Please enter your name and email.",
        variant: "destructive"
      });
      return;
    }
    
    setSubmitted(true);
    toast({
      title: "Request received",
      description: "We'll be in touch soon.",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">DraftFly</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Button size="sm" onClick={() => document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })}>
              Request Access
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {/* Section 1: Hero */}
        <section className="pt-40 pb-20 md:pt-52 md:pb-32 px-6 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
          
          <div className="container mx-auto text-center max-w-4xl relative z-10">
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground mb-8">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                DraftFly is in private beta
              </motion.div>
              
              <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
                The inbox is chaos. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400">
                  We make it a pipeline.
                </span>
              </motion.h1>
              
              <motion.p variants={fadeIn} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                DraftFly intercepts cold email replies, drafts AI-powered responses, and routes them to Slack for human approval. A professional weapon for high-output revenue teams.
              </motion.p>
              
              <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="h-12 px-8 text-base w-full sm:w-auto group" onClick={() => document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })}>
                  Get Early Access
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base w-full sm:w-auto bg-transparent border-white/10 hover:bg-white/5">
                  View Documentation
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Section 2: Terminal/Visual */}
        <section className="py-10 px-6 relative z-10">
          <div className="container mx-auto max-w-5xl">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="rounded-xl border border-white/10 bg-[#0A0A0F]/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-primary/5"
            >
              <div className="flex items-center px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="mx-auto text-xs text-muted-foreground font-mono">draftfly-operator-log</div>
              </div>
              <div className="p-6 md:p-8 font-mono text-sm md:text-base leading-relaxed text-muted-foreground">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-blue-400 shrink-0">14:02:11</span>
                  <span className="text-white/80">Incoming reply detected: <span className="text-primary">"Tell me more about pricing"</span> from j.smith@acme.co</span>
                </div>
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-blue-400 shrink-0">14:02:12</span>
                  <span className="text-white/80">Claude 3.5 Sonnet drafting response based on <span className="text-yellow-400">Acme_Corp_Persona</span> context...</span>
                </div>
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-blue-400 shrink-0">14:02:14</span>
                  <span className="text-green-400">Draft completed. Routing to #sales-approvals in Slack.</span>
                </div>
                <div className="mt-8 pt-6 border-t border-white/10 relative">
                  <div className="absolute top-[-10px] left-8 bg-[#0A0A0F] px-2 text-xs text-muted-foreground">Slack Notification</div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-white font-sans font-medium mb-1">DraftFly Bot <span className="text-xs font-normal text-muted-foreground ml-2">2:02 PM</span></p>
                      <p className="text-white/80 font-sans text-sm mb-3">New draft ready for <strong>John Smith (Acme Corp)</strong>.</p>
                      <div className="bg-white/5 border border-white/10 rounded-md p-4 font-sans text-sm text-white/70 mb-3">
                        "Hi John, happy to share pricing details. For a team your size, our Enterprise tier makes the most sense..."
                      </div>
                      <div className="flex gap-2 font-sans">
                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white border-0">Approve & Send</Button>
                        <Button size="sm" variant="outline" className="h-8 border-white/10 hover:bg-white/5">Edit Draft</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 3: How it works */}
        <section className="py-24 px-6 relative">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">A system built for scale</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Stop digging through shared inboxes. DraftFly creates a deterministic, highly-visible workflow for handling replies.</p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {[
                { icon: MessageSquare, title: "1. Intercept", desc: "Monitors your sending domains and pulls positive or interrogative replies instantly." },
                { icon: Zap, title: "2. Draft", desc: "Uses Claude to generate highly contextual, persona-matched responses in seconds." },
                { icon: Slack, title: "3. Route", desc: "Pushes the draft, context, and original thread into a dedicated Slack channel." },
                { icon: CheckCircle, title: "4. Approve", desc: "One click in Slack to approve and send, or drop into the web app to edit." }
              ].map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  {i < 3 && <div className="hidden md:block absolute top-6 left-12 right-0 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />}
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Features */}
        <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
                  Operator Grade
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Precision context mapping.</h2>
                <p className="text-lg text-muted-foreground mb-6">Generic AI replies destroy trust. DraftFly uses Persona mapping to ensure every drafted response aligns with the specific campaign context, pricing tier, and pain points the prospect was initially pitched.</p>
                <ul className="space-y-3">
                  {["Campaign-specific instructions", "Historical context retention", "Tone and style matching"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                      <Shield className="w-4 h-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative aspect-square md:aspect-auto md:h-[400px] rounded-xl bg-card border border-white/10 overflow-hidden p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="space-y-4">
                  <div className="bg-background border border-white/5 p-4 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-2">Persona: Enterprise CTO</div>
                    <div className="font-mono text-sm text-white/80">"Emphasize SOC2 compliance and SSO availability. Keep tone technical but concise."</div>
                  </div>
                  <div className="bg-background border border-white/5 p-4 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-2">Persona: VP Sales</div>
                    <div className="font-mono text-sm text-white/80">"Focus on ROI and ramp time. Mention the recent case study with Acme Corp."</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 5: Integrations */}
        <section className="py-24 px-6 relative">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <GitMerge className="w-10 h-10 text-primary mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Plugs into your stack.</h2>
              <p className="text-lg text-muted-foreground mb-12">No need to replace your sending infrastructure. DraftFly sits on top of your existing tools and acts as a routing layer.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  "Slack", "Gmail Workspace", "Outlook", "Lemlist", 
                  "Smartlead", "Instantly", "HubSpot", "Salesforce"
                ].map((tool, i) => (
                  <div key={i} className="flex items-center justify-center h-20 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white/80">
                    {tool}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 6: ROI/Metrics */}
        <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { metric: "4x", label: "Faster response times", desc: "SDRs approve drafts in seconds instead of writing from scratch." },
                { metric: "100%", label: "Visibility", desc: "No more black-box inboxes. Every reply is tracked in Slack." },
                { metric: "0", label: "Context lost", desc: "Claude retains full thread history and persona data for every reply." }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card border border-white/10 rounded-2xl p-8"
                >
                  <BarChart className="w-6 h-6 text-primary mb-6" />
                  <div className="text-5xl font-bold text-white mb-4">{stat.metric}</div>
                  <div className="text-lg font-semibold text-white/90 mb-2">{stat.label}</div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 7: Form */}
        <section id="early-access" className="py-32 px-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="container mx-auto max-w-2xl text-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Ready to regain control?</h2>
            <p className="text-lg text-muted-foreground mb-10">Join the private beta. We're currently onboarding high-volume sales agencies and revenue teams.</p>
            
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/20 text-green-400 p-6 rounded-xl flex flex-col items-center gap-4"
              >
                <CheckCircle className="w-8 h-8" />
                <div>
                  <h3 className="text-lg font-medium text-white mb-1">You're on the list</h3>
                  <p className="text-sm">We'll reach out when a spot opens up.</p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card border border-white/10 p-8 rounded-2xl shadow-xl text-left">
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Full Name</label>
                    <Input 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe" 
                      className="bg-background border-white/10 focus-visible:ring-primary h-12"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Work Email</label>
                    <Input 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email" 
                      placeholder="john@company.com" 
                      className="bg-background border-white/10 focus-visible:ring-primary h-12"
                    />
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full h-12 text-base">
                  Request Early Access
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6 bg-background">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-sm bg-primary/20 flex items-center justify-center border border-primary/30">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <span className="font-medium text-white/80">DraftFly</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="https://draftfly.app" className="hover:text-white transition-colors">draftfly.app</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}