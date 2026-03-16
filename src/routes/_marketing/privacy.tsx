import { PRIVACY_EMAIL, SITE_CONFIG } from '@/lib/marketing/constants';
import { createFileRoute } from '@tanstack/react-router';

const title = `Privacy Policy — ${SITE_CONFIG.name}`;

export const Route = createFileRoute('/_marketing/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `${SITE_CONFIG.url}/privacy` },
      { name: 'twitter:title', content: title },
    ],
  }),
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-32">
      <h1 className="font-heading text-4xl font-bold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Effective date: 16 March 2026
      </p>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        {SITE_CONFIG.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
        &ldquo;our&rdquo;) is an AI-powered video generation platform that
        transforms film scripts into complete video productions. We are
        committed to protecting the privacy of individuals who use our platform,
        visit our website, or otherwise interact with us.
      </p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        This Privacy Policy explains how we collect, use, disclose, store, and
        protect personal information in accordance with the{' '}
        <strong>Privacy Act 1988 (Cth)</strong> (&ldquo;Privacy Act&rdquo;), the{' '}
        <strong>Australian Privacy Principles</strong> (&ldquo;APPs&rdquo;), and
        the <strong>Privacy and Other Legislation Amendment Act 2024</strong>.
      </p>
      <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
        <p>
          <strong>Entity:</strong> {SITE_CONFIG.name} is based in New South
          Wales, Australia.
        </p>
        <p className="mt-1">
          <strong>Contact:</strong>{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
        </p>
        <p className="mt-1">
          <strong>Website:</strong>{' '}
          <a
            href={SITE_CONFIG.url}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {SITE_CONFIG.url}
          </a>
        </p>
      </div>

      {/* 2. Scope */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">2. Scope</h2>
        <p className="mt-4 leading-relaxed">
          This Privacy Policy applies to personal information collected through:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            The {SITE_CONFIG.name} platform and web application (
            <a
              href={SITE_CONFIG.url}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {SITE_CONFIG.url}
            </a>
            )
          </li>
          <li>Our application programming interfaces (APIs)</li>
          <li>Communications with us, including email and support channels</li>
          <li>Any related services, tools, or features we provide</li>
        </ul>
      </section>

      {/* 3. What Is Personal Information */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          3. What Is Personal Information
        </h2>
        <p className="mt-4 leading-relaxed">
          Under the Privacy Act, <strong>personal information</strong> means
          information or an opinion about an identified individual, or an
          individual who is reasonably identifiable, whether the information or
          opinion is true or not and whether it is recorded in a material form
          or not.
        </p>
        <p className="mt-4 leading-relaxed">
          Following the 2024 amendments, this definition encompasses technical
          identifiers such as IP addresses where they can be used to reasonably
          identify an individual.
        </p>
      </section>

      {/* 4. Information We Collect */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          4. Information We Collect
        </h2>

        <h3 className="mt-6 text-lg font-semibold">
          4.1 Information You Provide Directly
        </h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Account information:</strong> name, email address, password
            (stored in hashed form), and account preferences.
          </li>
          <li>
            <strong>Payment information:</strong> billing address and payment
            details. Payment card information is processed by our third-party
            payment processor and is not stored on our servers.
          </li>
          <li>
            <strong>Content and scripts:</strong> film scripts, scene
            descriptions, character descriptions, creative briefs, and other
            content you upload or input for video generation.
          </li>
          <li>
            <strong>Communications:</strong> messages you send to us via email,
            support requests, or feedback forms.
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">
          4.2 Information Collected Automatically
        </h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Usage data:</strong> features used, actions taken,
            generation history, timestamps, and session duration.
          </li>
          <li>
            <strong>Device and technical data:</strong> IP address, browser type
            and version, operating system, device identifiers, and screen
            resolution.
          </li>
          <li>
            <strong>Log data:</strong> server logs recording access times, pages
            viewed, referring URLs, and error reports.
          </li>
          <li>
            <strong>Cookies and similar technologies:</strong> we use cookies,
            local storage, and similar tracking technologies to operate and
            improve the platform.
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">
          4.3 Information from Third Parties
        </h3>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Authentication providers:</strong> if you sign in using a
            third-party service (e.g., Google), we receive your name, email, and
            profile picture as authorised by you.
          </li>
          <li>
            <strong>Analytics providers:</strong> aggregated and pseudonymised
            usage analytics.
          </li>
        </ul>
      </section>

      {/* 5. How We Use Your Information */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          5. How We Use Your Information
        </h2>
        <p className="mt-4 leading-relaxed">
          We collect and use personal information only for purposes that are
          reasonably necessary for, or directly related to, our functions and
          activities (APP 6). These purposes include:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Providing and operating the platform:</strong> processing
            your scripts, generating video content, managing your account, and
            delivering our services.
          </li>
          <li>
            <strong>AI processing:</strong> analysing scripts to identify
            scenes, characters, and visual elements, and generating images,
            video, and motion content using AI models. Your scripts and creative
            content may be processed by third-party AI model providers under
            data processing agreements.
          </li>
          <li>
            <strong>Improving our services:</strong> analysing usage patterns,
            diagnosing technical issues, developing new features, and enhancing
            platform performance.
          </li>
          <li>
            <strong>Communications:</strong> sending service-related notices,
            responding to inquiries, and providing customer support.
          </li>
          <li>
            <strong>Security and fraud prevention:</strong> detecting,
            preventing, and addressing security incidents, fraud, and abuse.
          </li>
          <li>
            <strong>Legal compliance:</strong> complying with applicable laws,
            regulations, legal processes, or enforceable governmental requests.
          </li>
          <li>
            <strong>Marketing (with consent):</strong> sending promotional
            communications where you have opted in. You may opt out at any time
            by using the unsubscribe link in any marketing email or by
            contacting us.
          </li>
        </ul>
      </section>

      {/* 6. Automated Decision-Making & AI */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          6. Automated Decision-Making &amp; AI Processing
        </h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name} uses automated processes, including artificial
          intelligence and machine learning systems, to analyse scripts,
          generate visual content, and produce video outputs. These systems make
          decisions about scene composition, character appearance, visual style,
          and video sequencing.
        </p>
        <p className="mt-4 leading-relaxed">
          In compliance with the transparency requirements introduced by the
          Privacy and Other Legislation Amendment Act 2024 (effective December
          2026), we disclose the following:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            We use AI models (including third-party large language models and
            image/video generation models) to process your script content.
          </li>
          <li>
            Automated processes determine scene breakdowns, character sheet
            generation, visual prompts, image generation, and video assembly.
          </li>
          <li>
            You retain the ability to review, modify, and regenerate any
            AI-produced output.
          </li>
          <li>
            No automated process is used to deny you access to our services or
            to make decisions that produce legal effects concerning you or
            similarly significantly affect your rights.
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          These automated processes are core to our service delivery and are
          used solely for the purpose of generating creative content based on
          your inputs.
        </p>
      </section>

      {/* 7. Disclosure of Personal Information */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          7. Disclosure of Personal Information
        </h2>
        <p className="mt-4 leading-relaxed">
          We may disclose personal information to the following categories of
          recipients:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Service providers:</strong> cloud hosting providers, payment
            processors, email delivery services, and analytics providers who
            process data on our behalf under contractual obligations.
          </li>
          <li>
            <strong>AI model providers:</strong> third-party AI services that
            process your content to generate images, video, and text analysis.
            These providers operate under data processing agreements that
            restrict their use of your data.
          </li>
          <li>
            <strong>Professional advisors:</strong> lawyers, accountants, and
            auditors where necessary.
          </li>
          <li>
            <strong>Law enforcement and regulators:</strong> where required by
            law, court order, or regulatory obligation, including to the OAIC.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with a sale or
            transfer of the business, personal information may be transferred to
            the successor entity.
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          <strong>We do not sell your personal information.</strong>
        </p>
      </section>

      {/* 8. Overseas Disclosure */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          8. Overseas Disclosure of Personal Information
        </h2>
        <p className="mt-4 leading-relaxed">
          As a cloud-based platform, personal information may be disclosed to,
          or stored in, countries outside Australia. This may include:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            The United States (cloud infrastructure providers, AI model
            providers)
          </li>
          <li>
            Other countries where our service providers maintain data centres
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          In accordance with APP 8, before disclosing personal information to an
          overseas recipient, we take reasonable steps to ensure the overseas
          recipient handles the information in accordance with the APPs. We
          achieve this through contractual arrangements and data processing
          agreements.
        </p>
        <p className="mt-4 leading-relaxed">
          Where a country has been whitelisted by the Governor-General under the
          Privacy and Other Legislation Amendment Act 2024 as providing
          substantially similar privacy protections, we may rely on that
          determination when making overseas disclosures.
        </p>
      </section>

      {/* 9. Data Retention */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          9. Data Retention
        </h2>
        <p className="mt-4 leading-relaxed">
          We retain personal information only for as long as reasonably
          necessary for the purposes described in this Policy, or as required by
          law:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Account information:</strong> retained for the duration of
            your account and for 12 months after account deletion, unless a
            longer period is required by law.
          </li>
          <li>
            <strong>Generated content:</strong> scripts, images, and videos you
            create are retained while your account is active. After account
            deletion, generated content is deleted within 90 days.
          </li>
          <li>
            <strong>Usage and log data:</strong> retained for up to 24 months
            for analytics and security purposes, then aggregated or deleted.
          </li>
          <li>
            <strong>Payment records:</strong> retained for 7 years as required
            by Australian taxation law.
          </li>
          <li>
            <strong>Support communications:</strong> retained for 24 months
            after resolution.
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          When personal information is no longer needed for any purpose for
          which it may be used or disclosed under the APPs, we take reasonable
          steps to destroy or de-identify it (APP 11.2).
        </p>
      </section>

      {/* 10. Data Security */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          10. Data Security
        </h2>
        <p className="mt-4 leading-relaxed">
          We take reasonable technical and organisational measures to protect
          personal information from misuse, interference, loss, unauthorised
          access, modification, and disclosure (APP 11.1). These measures
          include:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>Encryption of data in transit (TLS 1.2+) and at rest</li>
          <li>Access controls and authentication mechanisms</li>
          <li>Regular security assessments and monitoring</li>
          <li>Contractor and staff confidentiality obligations</li>
          <li>Incident response and data breach notification procedures</li>
        </ul>
        <p className="mt-4 leading-relaxed">
          No method of electronic storage or transmission is completely secure.
          While we strive to protect your personal information, we cannot
          guarantee its absolute security.
        </p>
      </section>

      {/* 11. Your Rights */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          11. Your Rights
        </h2>

        <h3 className="mt-6 text-lg font-semibold">
          11.1 Access to Personal Information (APP 12)
        </h3>
        <p className="mt-4 leading-relaxed">
          You may request access to the personal information we hold about you.
          We will respond to your request within 30 days. In certain
          circumstances permitted by the Privacy Act, we may refuse access (for
          example, where providing access would pose a serious threat to the
          life or health of any individual, or would unreasonably impact the
          privacy of others).
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          11.2 Correction of Personal Information (APP 13)
        </h3>
        <p className="mt-4 leading-relaxed">
          You may request that we correct personal information that is
          inaccurate, incomplete, out of date, irrelevant, or misleading. We
          will respond to correction requests within 30 days. If we refuse a
          correction request, we will provide written reasons and inform you of
          available complaint mechanisms.
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          11.3 Anonymity and Pseudonymity (APP 2)
        </h3>
        <p className="mt-4 leading-relaxed">
          Where practicable, you have the option of not identifying yourself or
          using a pseudonym when dealing with us. However, if you choose not to
          provide certain personal information, we may not be able to provide
          you with access to all features of the platform.
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          11.4 Direct Marketing (APP 7)
        </h3>
        <p className="mt-4 leading-relaxed">
          We will only use your personal information for direct marketing
          purposes where you have consented or where it is otherwise permitted
          under the Privacy Act. You may opt out of receiving marketing
          communications at any time by using the unsubscribe link in any
          marketing email or by contacting us at{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      </section>

      {/* 12. Statutory Tort */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          12. Statutory Tort for Serious Invasions of Privacy
        </h2>
        <p className="mt-4 leading-relaxed">
          From June 2025, Australia&rsquo;s statutory tort for serious invasions
          of privacy provides individuals with a personal right of action where
          their privacy has been seriously invaded through intrusion upon
          seclusion or misuse of personal information. We take this obligation
          seriously and have implemented measures to prevent any conduct that
          could constitute a serious invasion of privacy.
        </p>
      </section>

      {/* 13. Children's Privacy */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          13. Children&rsquo;s Privacy
        </h2>
        <p className="mt-4 leading-relaxed">
          {SITE_CONFIG.name} is not directed at children under the age of 18. We
          do not knowingly collect personal information from children. If we
          become aware that we have collected personal information from a child
          without appropriate parental consent, we will take steps to delete
          that information as soon as practicable.
        </p>
        <p className="mt-4 leading-relaxed">
          We are monitoring the development of Australia&rsquo;s
          Children&rsquo;s Online Privacy Code (to be registered by December
          2026) and will update our practices as required to comply with that
          code.
        </p>
      </section>

      {/* 14. Cookies & Tracking */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          14. Cookies &amp; Tracking Technologies
        </h2>
        <p className="mt-4 leading-relaxed">
          We use cookies and similar technologies for the following purposes:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Strictly necessary:</strong> essential for the platform to
            function, including authentication and security.
          </li>
          <li>
            <strong>Functional:</strong> remembering your preferences and
            settings.
          </li>
          <li>
            <strong>Analytics:</strong> understanding how users interact with
            the platform to improve our services.
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          You can manage cookie preferences through your browser settings.
          Disabling certain cookies may affect platform functionality.
        </p>
      </section>

      {/* 15. Notifiable Data Breaches */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          15. Notifiable Data Breaches
        </h2>
        <p className="mt-4 leading-relaxed">
          In the event of an eligible data breach as defined under Part IIIC of
          the Privacy Act, we will:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            Conduct an assessment within 30 days of becoming aware of reasonable
            grounds to suspect a breach
          </li>
          <li>
            Notify the OAIC and affected individuals as soon as practicable if
            the breach is likely to result in serious harm
          </li>
          <li>
            Include in the notification the nature of the breach, the types of
            information involved, and recommended steps for individuals
          </li>
        </ul>
      </section>

      {/* 16. Complaints */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          16. Complaints
        </h2>
        <p className="mt-4 leading-relaxed">
          If you believe we have breached the APPs or otherwise mishandled your
          personal information, you may lodge a complaint with us by contacting{' '}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
        <p className="mt-4 leading-relaxed">We will:</p>
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>Acknowledge your complaint within 5 business days</li>
          <li>Investigate and respond within 30 days</li>
          <li>Inform you of the outcome and any steps we will take</li>
        </ul>
        <p className="mt-4 leading-relaxed">
          If you are not satisfied with our response, you may escalate your
          complaint to the Office of the Australian Information Commissioner
          (OAIC):
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p>
            Website:{' '}
            <a
              href="https://www.oaic.gov.au"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              www.oaic.gov.au
            </a>
          </p>
          <p className="mt-1">Phone: 1300 363 992</p>
          <p className="mt-1">Post: GPO Box 5218, Sydney NSW 2001</p>
        </div>
      </section>

      {/* 17. Changes to This Policy */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          17. Changes to This Privacy Policy
        </h2>
        <p className="mt-4 leading-relaxed">
          We may update this Privacy Policy from time to time to reflect changes
          in our practices, technology, legal requirements, or other factors.
          When we make material changes, we will notify you by posting the
          updated Policy on our website and updating the &ldquo;Last
          Updated&rdquo; date. Where required by law, we will seek your consent
          before making material changes to how we process your personal
          information.
        </p>
      </section>

      {/* 18. Contact Us */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          18. Contact Us
        </h2>
        <p className="mt-4 leading-relaxed">
          If you have questions, concerns, or requests regarding this Privacy
          Policy or our handling of your personal information:
        </p>
        <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
          <p className="font-semibold">{SITE_CONFIG.name}</p>
          <p className="mt-1">
            Email:{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {PRIVACY_EMAIL}
            </a>
          </p>
          <p className="mt-1">
            Website:{' '}
            <a
              href={SITE_CONFIG.url}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {SITE_CONFIG.url}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
