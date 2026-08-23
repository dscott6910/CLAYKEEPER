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
            Information we collect
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper may collect account information,
            participant information, parent or guardian contact
            information, emergency contact information, role
            requests, team and organization information,
            registration selections, payment records, scoring
            and event operations data, support communications,
            and technical information needed to operate and
            secure the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            How we use information
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            We use information to create and manage accounts,
            process registrations, support organizations,
            maintain rosters, manage events, support scoring and
            reporting, process payments, communicate with users,
            improve ClayKeeper, and protect the service from
            misuse or unauthorized access.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Sharing information
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            ClayKeeper may share information with the
            organization connected to a registration or account,
            authorized organization staff, service providers
            that help operate ClayKeeper, payment processors,
            and others when required by law or needed to protect
            users, organizations, or the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Youth participant information
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Because ClayKeeper supports youth shooting sports,
            parent or guardian involvement may be required for
            minors. Organizations are responsible for their own
            eligibility, consent, safety, and retention
            requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-950">
            Questions
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            For privacy questions, contact ClayKeeper support or
            your organization administrator.
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
