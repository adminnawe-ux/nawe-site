import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { SITE_DOMAIN, SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';

const CrisisFooter = () => (
  <div className="bg-foreground/5 border-t border-border py-3 text-center">
    <p className="font-ui text-sm text-muted-foreground flex items-center justify-center gap-2">
      <Phone className="h-4 w-4 text-accent" />
      <span>If you're in crisis, please call your local emergency line or</span>
      <a
        href="https://findahelpline.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-secondary underline underline-offset-2 hover:text-secondary/80"
      >
        find a helpline near you
      </a>
    </p>
  </div>
);

const Footer = () => (
  <footer>
    <CrisisFooter />
    <div className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div>
            <img src="/nawe-logo.png" alt={SITE_NAME} className="h-20 w-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Find your calm. Find your person. Accessible mental health support for everyone.
            </p>
          </div>
          <div>
            <h4 className="font-ui font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">For Clients</h4>
            <ul className="space-y-2 font-body text-sm text-muted-foreground">
              <li><Link to="/questionnaire" className="hover:text-primary transition-colors">Find a Therapist</Link></li>
              <li><Link to="/how-it-works" className="hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link to="/resources" className="hover:text-primary transition-colors">Resources</Link></li>
              <li><Link to="/events" className="hover:text-primary transition-colors">Events</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-ui font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">For Therapists</h4>
            <ul className="space-y-2 font-body text-sm text-muted-foreground">
              <li><Link to="/for-therapists" className="hover:text-primary transition-colors">Join Our Network</Link></li>
              <li><Link to="/therapist-portal" className="hover:text-primary transition-colors">Therapist Portal</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-ui font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 font-body text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-ui font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">Contact</h4>
            <ul className="space-y-2 font-body text-sm text-muted-foreground">
              <li>
                <a href={`https://${SITE_DOMAIN}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                  {SITE_DOMAIN}
                </a>
              </li>
              <li>
                <a href={SUPPORT_PHONE_TEL} className="hover:text-primary transition-colors">
                  {SUPPORT_PHONE}
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary transition-colors">
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="font-ui text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
