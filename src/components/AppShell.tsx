import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import MainNav, { MainNavId } from './MainNav';
import Toast from './Toast';
import { ToastContext, useToastState } from '../hooks/useToast';

interface AppShellProps {
  current: MainNavId;
  children: React.ReactNode;
}

const PORTFOLIO_URL = 'https://medium.com/alex-couch-s-portfolio';
const COLUMN_URL = 'https://rollbamaroll.com';
const COFFEE_URL = 'https://buymeacoffee.com/alexcouch';

/**
 * Page frame shared by Games, Ratings, Trends and Discover: masthead, section
 * nav, footer, and the About/Contact modals. Each page used to carry its own
 * copy of all of this, so the four drifted apart; now they restyle together.
 */
const AppShell: React.FC<AppShellProps> = ({ current, children }) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToastState();
  const { showToast } = toast;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const result = await response.json();

      if (response.ok) {
        setContactForm({ name: '', email: '', message: '' });
        setShowContactModal(false);
        showToast("Message sent. I'll get back to you soon.");
      } else {
        showToast(result.error || 'Failed to send message. Please try again.');
      }
    } catch {
      showToast('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const aboutCopy = (
    <>
      This tool is the culmination of 10+ years of work. I&apos;m a{' '}
      <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
        product designer
      </a>{' '}
      by day, and I write an advanced analytics column for{' '}
      <a href={COLUMN_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
        RollBamaRoll.com
      </a>
      . I love data visualization, and am a big fan of college football from growing up.
    </>
  );

  const supportButton = (
    <a
      href={COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
    >
      Buy me a coffee
    </a>
  );

  return (
    <ToastContext.Provider value={toast}>
    <div className="flex min-h-screen flex-col bg-paper">
      {/* No bottom padding on the header itself — the nav tabs supply it, so
          the active tab's underline meets the masthead rule. */}
      <header className="masthead-rule bg-paper">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
          <div className="flex items-start justify-between gap-3 sm:pb-4">
            <div>
              <a href="/games" className="block">
                <h1 className="headline text-[23px] leading-none text-ink sm:text-[26px]">
                  Graphing College Football
                </h1>
              </a>
              <p className="mt-1 text-sm text-byline">
                Advanced play-by-play metrics<span className="hidden sm:inline"> and visualizations</span>
              </p>
            </div>

            <button
              onClick={() => setShowInfoModal(true)}
              className="-mr-1 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-byline transition-colors hover:bg-neutral-100 hover:text-ink sm:hidden"
              title="About this project"
              aria-label="About this project"
            >
              <Info className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* gap-5 + a 28px button puts the info glyph ~25px from the last tab,
              matching the 24px rhythm between the tabs themselves. A 32px
              button at gap-6 read as 31px — visibly detached from the group. */}
          <div className="flex items-end gap-5">
            <MainNav current={current} />
            {/* The tabs carry 1rem of padding below their text, so matching
                that margin would centre the icon on the tab *box* and leave it
                riding high above the labels. This lines it up with the text. */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="mb-3 hidden h-7 w-7 items-center justify-center rounded-lg text-byline transition-colors hover:bg-neutral-100 hover:text-ink sm:flex"
              title="About this project"
              aria-label="About this project"
            >
              <Info className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow py-7 sm:py-9">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>

      <footer className="mt-14 border-t border-hairline">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-9 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h2 className="headline text-[20px] font-bold text-ink">About this project</h2>
            <p className="text-sm leading-relaxed text-neutral-700">{aboutCopy}</p>
            <p className="text-sm text-neutral-700">
              If you find this useful, feel free to buy me a coffee to support continued development.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {supportButton}
              <button
                onClick={() => setShowContactModal(true)}
                className="text-sm font-medium text-accent underline underline-offset-2 transition-opacity hover:opacity-80"
              >
                Get in touch
              </button>
            </div>
          </div>
        </div>
      </footer>

      <Toast
        message={toast.message}
        type="success"
        isVisible={toast.isVisible}
        nonce={toast.nonce}
        onClose={toast.hideToast}
      />

      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="About this project"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-hairline bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="headline text-[22px] font-bold text-ink">About this project</h2>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-byline transition-colors hover:bg-neutral-100 hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-neutral-700">{aboutCopy}</p>
                <p className="text-sm text-neutral-700">
                  If you find this useful, feel free to buy me a coffee to support continued development.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {supportButton}
                  <button
                    onClick={() => {
                      setShowInfoModal(false);
                      setShowContactModal(true);
                    }}
                    className="text-sm font-medium text-accent underline underline-offset-2 transition-opacity hover:opacity-80"
                  >
                    Get in touch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContactModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Get in touch"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-hairline bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <h2 className="headline text-[22px] font-bold text-ink">Get in touch</h2>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-byline transition-colors hover:bg-neutral-100 hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'name', label: 'Your name', type: 'text', placeholder: 'Enter your name' },
                    { id: 'email', label: 'Your email', type: 'email', placeholder: 'Enter your email' },
                  ].map((field) => (
                    <div key={field.id}>
                      <label htmlFor={field.id} className="mb-1.5 block text-sm font-medium text-neutral-700">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        id={field.id}
                        name={field.id}
                        value={contactForm[field.id as 'name' | 'email']}
                        onChange={handleChange}
                        required
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-sm text-ink placeholder-neutral-400 focus:border-accent focus:outline-none"
                      />
                    </div>
                  ))}

                  <div>
                    <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-neutral-700">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={contactForm.message}
                      onChange={handleChange}
                      required
                      rows={4}
                      placeholder="Enter your message"
                      className="w-full resize-none rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-sm text-ink placeholder-neutral-400 focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSubmitting ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ToastContext.Provider>
  );
};

export default AppShell;
