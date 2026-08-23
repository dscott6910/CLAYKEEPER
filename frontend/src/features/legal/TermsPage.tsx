import { Link } from "react-router-dom"
import type { ReactNode } from "react"

import {
  APP_VERSION,
  CLAYKEEPER_LOGO,
} from "@/lib/branding"

const sections = [
  {
    title: "1. Acceptance of these Terms",
    body: [
      "These Terms of Use are made between you and ClayKeeper. “ClayKeeper,” “we,” “us,” or “our” means the ClayKeeper software, website, registration tools, scoring tools, and related services. “You” means the person using ClayKeeper, or the parent or legal guardian if the user is a minor.",
      "By accessing or using ClayKeeper, creating an account, registering a participant, requesting organization access, submitting information, or paying registration or subscription fees, you agree to these Terms and any organization-specific registration rules shown during signup.",
    ],
  },
  {
    title: "2. Youth participants and parent/guardian consent",
    body: [
      "ClayKeeper is used by youth shooting sports organizations. If a participant is a minor, a parent or legal guardian must complete registration, consent to the participant’s use of the service, and provide accurate participant, emergency contact, and payment information.",
      "Organizations are responsible for their own safety rules, eligibility requirements, waivers, event policies, coaching requirements, and compliance obligations. ClayKeeper provides software tools; it does not operate, supervise, sanction, or control any shooting activity.",
    ],
  },
  {
    title: "3. Accounts and registration information",
    body: [
      "You agree to provide true, accurate, current, and complete information when creating an account, registering a participant, requesting coach, scorekeeper, admin, or volunteer access, or completing payment. You are responsible for keeping your login credentials secure.",
      "You may not impersonate another person, create an account using another person’s information without permission, request a role you are not authorized to hold, or attempt to access organization data outside your permitted role.",
    ],
  },
  {
    title: "4. Organization roles and approvals",
    body: [
      "Coach, scorekeeper, administrator, and volunteer access may require approval by an organization owner or administrator. Submitting an access request does not guarantee approval and does not automatically grant permissions.",
      "Organizations are responsible for deciding who may access their organization data and for removing access when it is no longer appropriate.",
    ],
  },
  {
    title: "5. Payments, refunds, and fees",
    body: [
      "ClayKeeper may allow registration fees, season dues, subscription fees, and other payments to be collected online. You agree to pay all charges shown during checkout, plus any applicable taxes or processing fees.",
      "Unless stated otherwise during checkout, refund rules are set by the organization offering the registration, season, event, or activity. Payment processors may have separate terms that also apply to your transaction.",
    ],
  },
  {
    title: "6. Code of conduct",
    body: [
      "You agree not to misuse ClayKeeper. This includes attempting to bypass security, access data you are not authorized to view, interfere with the service, upload harmful code, scrape the service, harass others, submit false information, or use ClayKeeper for unlawful purposes.",
      "You also agree not to post or submit content that is threatening, abusive, defamatory, obscene, discriminatory, infringing, fraudulent, or otherwise inappropriate for a youth sports registration and operations platform.",
    ],
  },
  {
    title: "7. Scores, rosters, results, and organization data",
    body: [
      "ClayKeeper stores and displays information such as participant records, teams, rosters, registrations, check-in status, squadding, scores, awards, leaderboards, reports, and payment records. Some results or event information may be visible to organization members or the public when an organization enables public display.",
      "Organizations are responsible for reviewing their data, correcting errors, and deciding what information should be published. If you believe information is incorrect or should be removed, contact the organization first.",
    ],
  },
  {
    title: "8. Ownership and permitted use",
    body: [
      "ClayKeeper, including its software, design, workflows, logos, text, graphics, and related materials, is owned by ClayKeeper or its licensors. You may use ClayKeeper only for lawful registration, event management, scoring, reporting, and related organization purposes.",
      "You may not copy, reverse engineer, resell, sublicense, or create competing services from ClayKeeper except as expressly allowed by written permission.",
    ],
  },
  {
    title: "9. Third-party services",
    body: [
      "ClayKeeper may connect to or rely on third-party services such as authentication providers, hosting providers, payment processors, email services, analytics tools, database services, or import/export tools. Those services may have their own terms and privacy practices.",
      "ClayKeeper is not responsible for third-party service outages, payment processor decisions, email delivery failures, browser issues, internet connectivity, or device problems outside our control.",
    ],
  },
  {
    title: "10. Disclaimers and limitation of liability",
    body: [
      "ClayKeeper is provided on an “as is” and “as available” basis. We work to provide reliable tools, but we do not guarantee that the service will be uninterrupted, error-free, or suitable for every organization’s requirements.",
      "To the fullest extent permitted by law, ClayKeeper will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, revenue, profits, goodwill, or business opportunity arising from your use of the service.",
    ],
  },
  {
    title: "11. Suspension or termination",
    body: [
      "We may suspend or terminate access if we believe an account is being misused, creates security risk, violates these Terms, violates law, or threatens the safety, privacy, or integrity of ClayKeeper, an organization, or another user.",
      "Organizations may also deactivate or remove user access for their own organization.",
    ],
  },
  {
    title: "12. Changes to these Terms",
    body: [
      "We may update these Terms from time to time. When we make material changes, we will make reasonable efforts to provide notice through the service or another appropriate method. Continued use of ClayKeeper after changes become effective means you accept the updated Terms.",
    ],
  },
  {
    title: "13. Questions",
    body: [
      "If you have questions about these Terms, contact ClayKeeper support or your organization administrator. Organization-specific registration, refund, safety, and eligibility questions should be directed to the organization offering the season, event, or activity.",
    ],
  },
]

export function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" effectiveDate="August 23, 2026">
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        This ClayKeeper Terms of Use page is a working draft for
        product setup and should be reviewed by qualified legal
        counsel before production payment collection.
      </p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-bold text-slate-950">
              {section.title}
            </h2>

            <div className="mt-3 space-y-3">
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm leading-7 text-slate-600"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </LegalPageShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" effectiveDate="August 23, 2026">
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        This ClayKeeper Privacy Policy is a working draft for
        product setup and should be reviewed by qualified legal
        counsel before production payment collection.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Overview
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper provides registration, participant
            management, event operations, scoring, reporting,
            payment tracking, and organization administration
            tools for shooting sports organizations. This
            Privacy Policy explains how ClayKeeper may collect,
            use, disclose, store, and protect personal
            information when you use the ClayKeeper website,
            application, registration pages, scoring tools, or
            related services.
          </p>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            If you register through an organization that uses
            ClayKeeper, that organization may also receive and
            use your information for its own registration,
            eligibility, safety, event, payment, communication,
            and recordkeeping purposes. You should contact the
            organization directly with questions about its
            independent privacy practices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Personal information we may collect
          </h2>

          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
            <p>
              Depending on how you use ClayKeeper, we may collect:
            </p>

            <ul className="list-disc space-y-2 pl-5">
              <li>
                Account information, such as name, email address,
                password credentials, organization membership, and
                role.
              </li>
              <li>
                Youth shooter or participant information, such as
                name, date of birth, graduation year, gender,
                phone number, membership numbers, emergency
                contact information, team, class, registration
                selections, and notes submitted during
                registration.
              </li>
              <li>
                Parent, guardian, coach, scorekeeper,
                administrator, or volunteer information, such as
                name, email address, phone number, requested
                access role, approval status, and messages sent to
                the organization.
              </li>
              <li>
                Event and competition information, such as
                registrations, check-in status, squadding, scores,
                awards, results, leaderboard entries, reports, and
                related operational records.
              </li>
              <li>
                Payment and commercial information, such as
                selected sessions or disciplines, fees, payment
                status, transaction records, refunds, adjustments,
                receipt email, and payment provider references.
              </li>
              <li>
                Technical information, such as browser, device,
                IP address, log data, usage activity, security
                events, and information collected through cookies
                or similar technologies.
              </li>
              <li>
                Support and communication information, such as
                messages, questions, feedback, and information you
                provide when requesting help.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            How we use personal information
          </h2>

          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
            <p>
              ClayKeeper may use personal information to:
            </p>

            <ul className="list-disc space-y-2 pl-5">
              <li>Create and manage user accounts.</li>
              <li>
                Process youth shooter registrations, season
                discipline selections, subscriptions, and event
                participation.
              </li>
              <li>
                Maintain organization rosters, teams, classes,
                participant numbers, registrations, squadding,
                scoring, results, awards, leaderboards, and
                reports.
              </li>
              <li>
                Process payments, refunds, adjustments, receipts,
                and payment reconciliation.
              </li>
              <li>
                Review and manage coach, scorekeeper, admin, and
                volunteer access requests.
              </li>
              <li>
                Communicate with users about accounts,
                registrations, payments, events, operations,
                support, and security.
              </li>
              <li>
                Operate, improve, troubleshoot, secure, and
                monitor ClayKeeper.
              </li>
              <li>
                Detect, prevent, investigate, and respond to
                fraud, misuse, unauthorized access, technical
                problems, safety issues, or legal obligations.
              </li>
              <li>
                Create aggregated or de-identified information
                for reporting, analytics, reliability, and product
                improvement.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Sensitive personal information
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Some information used by ClayKeeper may be considered
            sensitive under applicable privacy laws, including
            login credentials, payment-related information,
            youth participant information, emergency contact
            information, and information connected to safety or
            eligibility. ClayKeeper uses sensitive information
            only as needed to provide and secure the service,
            support organizations and users, process
            registrations and payments, comply with law, and
            protect the safety and integrity of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Information organizations collect through ClayKeeper
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            When you register for a season, event, discipline, or
            activity, you may provide information that is needed
            by the organization offering that registration.
            Authorized organization users may access participant
            records, rosters, emergency contact details,
            registration history, payment status, scoring records,
            reports, and other information needed to operate the
            organization and its events. Organizations may also
            ask for additional information, waivers, acknowledgments,
            or consents according to their own rules.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            How we disclose information
          </h2>

          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
            <p>
              ClayKeeper may disclose personal information to:
            </p>

            <ul className="list-disc space-y-2 pl-5">
              <li>
                The organization connected to your account,
                registration, role request, or event activity.
              </li>
              <li>
                Authorized organization owners, administrators,
                coaches, scorekeepers, and volunteers according
                to their permissions.
              </li>
              <li>
                Service providers that help us operate, host,
                secure, support, analyze, or improve ClayKeeper.
              </li>
              <li>
                Payment processors and financial service
                providers needed to complete transactions,
                refunds, receipts, fraud checks, and related
                payment operations.
              </li>
              <li>
                Legal, regulatory, safety, or law enforcement
                authorities when required by law or when we
                believe disclosure is reasonably necessary to
                protect rights, safety, users, organizations, or
                the service.
              </li>
              <li>
                Successors or parties involved in a business
                transaction, such as a merger, acquisition,
                financing, reorganization, or sale of assets,
                subject to appropriate protections.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Public event information and results
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Organizations may choose to publish event information,
            schedules, leaderboards, scores, awards, or results
            through ClayKeeper. Published results may include
            participant names, teams, classes, scores, standings,
            and awards. If you believe published information is
            inaccurate or should be removed, contact the
            organization responsible for the event.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Cookies and similar technologies
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper may use cookies, local storage, log files,
            and similar technologies to keep you signed in,
            remember registration progress, preserve shopping cart
            selections, improve performance, understand usage,
            and protect the service. If you disable cookies or
            local storage, some ClayKeeper features may not work
            correctly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Third-party links and services
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper may link to or integrate with third-party
            websites or services, including payment processors,
            authentication providers, email providers, hosting
            providers, database providers, analytics providers,
            and organization websites. Their privacy practices are
            governed by their own policies, not this Privacy
            Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            How we protect and store information
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper uses technical and organizational measures
            designed to protect personal information from
            accidental loss, unauthorized access, disclosure,
            alteration, or misuse. No system can be guaranteed
            completely secure. You are responsible for protecting
            your account credentials, using a secure device, and
            signing out when using shared devices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Retention
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            We retain personal information for as long as needed
            to provide ClayKeeper, support organizations,
            maintain registration and scoring records, comply
            with legal and accounting obligations, resolve
            disputes, enforce agreements, secure the service, and
            preserve backup and disaster recovery records.
            Organizations may have their own record retention
            requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Children and minors
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper supports youth shooting sports and may
            process information about minors when a parent,
            guardian, organization, coach, or authorized user
            provides that information for registration, team,
            event, safety, scoring, or reporting purposes.
            Parents or legal guardians should complete youth
            shooter registration when required and should contact
            the organization with questions about participation,
            eligibility, safety rules, or organization-specific
            consent requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Your choices and rights
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Depending on where you live, you may have rights to
            access, correct, delete, restrict, object to, or
            receive a copy of certain personal information. You
            may also be able to update some account information
            directly in ClayKeeper. Because organizations control
            many registration and event records, some requests may
            need to be handled by the organization connected to
            the record.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Changes to this Privacy Policy
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            We may update this Privacy Policy from time to time.
            When we make material changes, we will make
            reasonable efforts to provide notice through the
            service or another appropriate method. The effective
            date above shows when this draft was last updated.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Contact us
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            For privacy questions about ClayKeeper, contact
            ClayKeeper support. For organization-specific
            questions about registration, eligibility, events,
            safety rules, refunds, published results, or removal
            of organization records, contact the organization
            administrator.
          </p>
        </section>
      </div>
    </LegalPageShell>
  )
}

function LegalPageShell({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/login">
            <img
              src={CLAYKEEPER_LOGO}
              alt="ClayKeeper TMK"
              className="h-24 w-56 object-contain object-left"
            />
          </Link>

          <Link
            to="/login"
            className="text-sm font-semibold text-slate-600 hover:text-emerald-700"
          >
            Back to ClayKeeper
          </Link>
        </div>

        <header className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            ClayKeeper v{APP_VERSION}
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
            {title}
          </h1>

          <p className="mt-3 text-sm font-semibold text-slate-500">
            Effective Date: {effectiveDate}
          </p>
        </header>

        <div className="mt-8">{children}</div>
      </article>
    </main>
  )
}
