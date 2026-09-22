import React from 'react';
import Header from '../../components/home/Header/Header';
import Footer from '../../components/home/Footer/Footer';
import './FAQ.css';

const FAQ_ITEMS = [
  {
    question: 'Do I need an account to browse the menu?',
    answer: 'No. You can look through every brand and menu freely without signing up. You only need an account once you\'re ready to actually place an order.'
  },
  {
    question: 'How much is delivery?',
    answer: 'A flat ₱75 per delivery location. A night surcharge (+50%) applies after 8:00 PM for student accounts, or after 6:30 PM for non-student accounts.'
  },
  {
    question: 'How do I pay for my order?',
    answer: 'Food and item orders are cash on delivery - pay the rider when your order arrives. Bill payments (Pay Bills) work differently: you upload your bill receipt and proof of payment (e.g. a transfer screenshot) when you submit the request, and our team verifies it before it\'s processed.'
  },
  {
    question: 'Can I cancel an order after placing it?',
    answer: 'Yes, but only while it\'s still waiting for a rider to accept it. Once it\'s been confirmed, it can no longer be self-cancelled - contact us directly if something comes up after that point.'
  },
  {
    question: 'How do I know where my order is?',
    answer: 'Open the notification bell in the header and switch to "Track Orders." You\'ll see your real position in the queue and its current status, updated automatically as it moves from waiting, to confirmed, to preparing, to out for delivery.'
  },
  {
    question: 'Can I order from more than one brand at once?',
    answer: 'Add items from different brands to your cart and they\'ll be placed as separate orders when you check out, since each comes from a different kitchen/establishment.'
  },
  {
    question: 'I forgot my password. What do I do?',
    answer: 'Use "Forgot password?" on the sign-in screen to reset it by email.'
  },
  {
    question: 'Something went wrong with my order - who do I contact?',
    answer: 'Reach us through our Facebook page linked in the footer below. We read and respond to messages there.'
  }
];

const FAQ = () => (
  <div className="home-page">
    <Header services={[]} onServiceChange={() => {}} onSearch={() => {}} />
    <main className="faq-page">
      <div className="faq-heading">
        <span className="faq-eyebrow">Help center</span>
        <h1>Frequently asked questions</h1>
        <p>The things customers ask us most, answered directly.</p>
      </div>
      <div className="faq-list">
        {FAQ_ITEMS.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </main>
    <Footer onServiceChange={() => {}} />
  </div>
);

export default FAQ;
