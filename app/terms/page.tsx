'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <h2 className="text-lg font-semibold mb-4 text-white">{title}</h2>
      <div className="space-y-3 text-sm text-neutral-400 leading-relaxed">{children}</div>
    </div>
  )
}

export default function TermsPage() {
  const router = useRouter()
  const effective = 'May 27, 2026'

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-md px-6 md:px-12 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <span className="text-white font-light tracking-[0.35em] text-base select-none">THIMBLE</span>
        <div className="w-16" />
      </nav>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-20">

        {/* Header */}
        <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-4 font-medium">Legal</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Terms of Service</h1>
        <p className="text-neutral-500 text-sm mb-16">Effective date: {effective}</p>

        <Section title="1. Acceptance of Terms">
          <p>By creating an account on Thimble ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Platform.</p>
          <p>Thimble is operated by THIMBLE ("we", "us", "our"). These Terms govern your use of tvimble.tech and all associated services.</p>
          <p>We may update these Terms from time to time. Continued use of the Platform after any changes constitutes your acceptance of the revised Terms. We will notify you of material changes via email or a notice on the Platform.</p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 18 years old to use Thimble. By creating an account, you represent that you meet this requirement.</p>
          <p>You must provide accurate, current, and complete information when creating your account and keep this information up to date.</p>
          <p>Accounts are personal and non-transferable. You may not create an account on behalf of another person without their explicit consent.</p>
        </Section>

        <Section title="3. Your Account">
          <p>You are responsible for maintaining the security of your account credentials. Do not share your password with anyone.</p>
          <p>You are responsible for all activity that occurs under your account. If you suspect unauthorised access, notify us immediately at support@tvimble.tech.</p>
          <p>We reserve the right to suspend or terminate your account if we have reason to believe you have violated these Terms, engaged in fraudulent activity, or posed a risk to other users.</p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree to use Thimble only for lawful purposes and in a manner consistent with the fashion industry professional community we are building.</p>
          <p>You must not:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Impersonate any person or misrepresent your identity or professional credentials</li>
            <li>Post content that is abusive, harassing, threatening, defamatory, or discriminatory</li>
            <li>Attempt to solicit payments or personal financial details outside of the Thimble platform</li>
            <li>Use the Platform to distribute spam, malware, or unsolicited commercial messages</li>
            <li>Scrape, crawl, or systematically extract data from the Platform</li>
            <li>Attempt to circumvent the Platform's security features or access systems you are not authorised to use</li>
            <li>Use the Platform to facilitate any illegal transaction or activity</li>
          </ul>
          <p>Violation of these rules may result in immediate account termination and, where appropriate, referral to relevant authorities.</p>
        </Section>

        <Section title="5. Verification">
          <p>Thimble offers an optional verification programme. Verified status is granted at our sole discretion following a review of submitted identity and portfolio documentation.</p>
          <p>Submitting false or fraudulent documents as part of a verification request is a serious violation of these Terms and will result in permanent account termination.</p>
          <p>Verification confirms identity and professional presence. It does not constitute an endorsement of the quality of your work or the terms of any collaboration you enter into.</p>
        </Section>

        <Section title="6. Content">
          <p>You retain ownership of all content you post on Thimble. By posting content, you grant Thimble a non-exclusive, royalty-free, worldwide licence to display and distribute that content within the Platform for the purpose of operating the service.</p>
          <p>You are solely responsible for the content you post. Do not post content you do not have the right to share, including copyrighted images, other people's portfolio work, or private information about third parties.</p>
          <p>We reserve the right to remove any content that violates these Terms or that we determine, in our sole discretion, is harmful to the Platform or its users.</p>
        </Section>

        <Section title="7. Payments and Escrow">
          <p>Thimble facilitates payments between users through a secure escrow system. When a client initiates a payment for a project, funds are held by Thimble and released to the creative upon successful delivery and approval of the agreed work.</p>
          <p>We strongly advise against conducting any financial transactions related to work agreed on Thimble outside of the Platform's payment system. We cannot offer any protection for payments made outside of escrow.</p>
          <p>Transaction fees, if applicable, will be disclosed before any payment is confirmed. All fees are non-refundable except where required by law.</p>
          <p>Disputes regarding payment or project delivery must be raised through the Platform's dispute resolution process. We will review all relevant communications and materials and make a determination in good faith.</p>
        </Section>

        <Section title="8. Privacy">
          <p>Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using Thimble, you consent to the collection and use of your information as described in the Privacy Policy.</p>
          <p>We do not sell your personal data to third parties. We will not share your data except as described in our Privacy Policy or as required by law.</p>
          <p>Your email address is never publicly visible on the Platform. Only your name, role, bio, and content you choose to post are visible to other users.</p>
        </Section>

        <Section title="9. Intellectual Property">
          <p>The Thimble name, logo, platform design, and all associated software are the exclusive property of THIMBLE and are protected by applicable intellectual property law.</p>
          <p>You may not reproduce, copy, distribute, or create derivative works of any part of the Platform without our prior written consent.</p>
        </Section>

        <Section title="10. Disclaimers and Limitation of Liability">
          <p>Thimble is provided on an "as is" and "as available" basis. We do not warrant that the Platform will be uninterrupted, error-free, or free of harmful components.</p>
          <p>We are not a party to any agreement, collaboration, or transaction between users. We do not endorse any user or guarantee the quality of any work delivered through the Platform.</p>
          <p>To the fullest extent permitted by law, Thimble shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform or any collaboration entered into through it.</p>
          <p>Our total liability to you for any claim arising from use of the Platform shall not exceed the total amount of fees you have paid to Thimble in the three months preceding the claim.</p>
        </Section>

        <Section title="11. Termination">
          <p>You may delete your account at any time via Settings → Account → Delete Account. Upon deletion, your data and content will be permanently removed from the Platform.</p>
          <p>We reserve the right to suspend or terminate any account at any time for violation of these Terms, fraudulent activity, or any conduct we determine to be harmful to the Platform or its users.</p>
          <p>Upon termination, your right to use the Platform ceases immediately. Any outstanding escrow funds will be handled in accordance with our payment policies.</p>
        </Section>

        <Section title="12. Governing Law">
          <p>These Terms are governed by and construed in accordance with applicable law. Any disputes arising from these Terms or your use of the Platform shall be subject to the exclusive jurisdiction of the competent courts.</p>
        </Section>

        <Section title="13. Contact">
          <p>If you have any questions about these Terms, please contact us at:</p>
          <p className="text-neutral-300 font-medium">support@tvimble.tech</p>
        </Section>

        <div className="border-t border-neutral-800 pt-8 mt-4">
          <p className="text-xs text-neutral-600">Last updated: {effective}. These Terms supersede all previous versions.</p>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 md:px-12 py-8 mt-10">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-light tracking-[0.35em] text-sm select-none">THIMBLE</span>
          <p className="text-xs text-neutral-600">&copy; {new Date().getFullYear()} Thimble. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-neutral-600">
            <button onClick={() => router.push('/about')} className="hover:text-neutral-400 transition-colors">About</button>
            <button onClick={() => router.push('/help')} className="hover:text-neutral-400 transition-colors">Help</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
