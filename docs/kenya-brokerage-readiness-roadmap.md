# HikeyFX Kenya Brokerage Readiness Roadmap

**Target:** Establish HikeyFX as an independently licensed Kenyan non-dealing online forex broker, subject to CMA approval.

**Status:** Pre-incorporation / pre-application planning. HikeyFX is not represented as a licensed broker. The current HikeyFX trading application remains a demo/software project and must not accept client money or route real client orders.

## 1. Intended regulatory model

The initial target is a **Non-Dealing Online Foreign Exchange Broker** licensed by the Capital Markets Authority (CMA). Under the Online Foreign Exchange Trading Regulations, a non-dealing broker links clients to the market for commission or a spread mark-up and does not act as market maker.

Do not offer brokerage, onboard real-money clients, collect deposits, advertise HikeyFX as a broker, or execute client trades until the necessary licence and approvals are in place. A partnership, introducing arrangement, white-label, or technology-provider model must be reviewed by Kenyan capital-markets counsel and cleared with CMA where required; it is not an assumed workaround.

## 2. Regulatory baseline to confirm with CMA and counsel

The CMA's published 2017 Online Foreign Exchange Trading Regulations (as amended in 2023) set out, among other things:

- Applicant must be a company incorporated in Kenya and limited by shares.
- CEO must be fit and proper, have at least five years' relevant foreign-exchange experience, and belong to a professional body.
- Directors, substantial shareholders and key personnel must satisfy fit-and-proper requirements.
- The applicant must have suitable premises, equipment, staff and operating infrastructure.
- Minimum paid-up capital for a non-dealing online forex broker: **KES 30,000,000**, not impaired.
- Minimum liquid capital: **KES 30,000,000 or 8% of total liabilities, whichever is higher**, maintained at all times.
- Application requires a letter from a recognised online forex trading platform confirming that the applicant meets platform requirements and will be admitted if licensed.
- Application materials include business plan, client onboarding, individual risk assessment, AML/KYC, product-sensitisation and appropriateness framework, complaints/dispute resolution procedures, and relevant service-level agreements.
- Continuing obligations include periodic regulatory returns, complaints reporting, reconciliations, management accounts, risk-based capital reporting and traded-volume reporting.

The CMA's online-forex amendment regulations of 2023 introduced an annual fee based on gross trading revenue. Confirm the current calculation, any interaction with fixed annual fees, and current application/annual fees directly with CMA before preparing a financial budget.

**Important:** CMA's online-forex checklist currently published on its website is dated 23 August 2023, while CMA also publishes newer general licensing requirements and 2025 general licensing amendments. The checklist and underlying regulations must be reconciled with the current CMA requirements before submission. Do not treat this roadmap as legal advice or a final legal checklist.

## 3. CMA application readiness checklist

### Corporate and ownership
- [ ] Reserve and approve the HikeyFX legal company name.
- [ ] Incorporate a Kenyan company limited by shares.
- [ ] Prepare objects in the memorandum/articles that expressly permit the proposed regulated activity, subject to legal advice.
- [ ] Confirm beneficial ownership and shareholder structure.
- [ ] Obtain certified incorporation and constitutional documents.
- [ ] Establish a board meeting the current CMA governance requirements.
- [ ] Appoint a qualified company secretary.
- [ ] Prepare director, shareholder and key-person fit-and-proper packs, CVs, declarations, police clearances and credit-reference clearances as applicable.

### Capital and finance
- [ ] Evidence at least KES 30m paid-up capital for the non-dealing licence.
- [ ] Demonstrate capacity to maintain liquid capital at the higher of KES 30m or 8% of total liabilities.
- [ ] Obtain bank reference and establish appropriate banking arrangements.
- [ ] Obtain auditor engagement and accounting policies.
- [ ] Prepare three-year financial projections and capital/liquidity stress scenarios.
- [ ] Model application fees, annual fixed fees and gross-trading-revenue-based fees using current CMA guidance.

### Management and control functions
- [ ] Identify CEO meeting the five-year FX experience and professional-body requirements.
- [ ] Appoint qualified finance, risk, compliance/AML and internal-audit functions as required.
- [ ] Confirm applicable CISI/SICP and professional qualification requirements with CMA.
- [ ] Establish independent board oversight, audit committee, board charter and conflicts-of-interest controls.
- [ ] Secure appropriate professional indemnity / key-person insurance where required.

### Platform, execution and counterparties
- [ ] Select a recognised trading platform and obtain its conditional admission/eligibility letter.
- [ ] Select and conduct due diligence on liquidity providers / execution counterparties.
- [ ] Negotiate execution, pricing, market-data, hosting, disaster-recovery and support SLAs.
- [ ] Define best-execution, order-handling, slippage, requote, outage and trade-error policies.
- [ ] Establish client-money banking and segregation arrangements with qualified institutions.
- [ ] Obtain legal review of all third-party and cross-border arrangements.

### Client protection and operations
- [ ] KYC, sanctions and AML/CFT policies and risk scoring.
- [ ] Client appropriateness assessment and risk warnings.
- [ ] Client agreement, order execution policy, fee/spread disclosure and conflicts policy.
- [ ] Negative-balance and margin close-out controls, as required by current CMA directions.
- [ ] Complaints handling, escalation and dispute-resolution process.
- [ ] Daily client-money and trading reconciliation.
- [ ] Data protection, cybersecurity, access control, audit logging and incident response.
- [ ] Business continuity, backups, disaster recovery and operational resilience.
- [ ] Regulatory reporting calendar and evidence repository.

## 4. HikeyFX product workstreams

Keep the existing demo environment isolated from all future real brokerage functions.

### Required architecture before live trading
1. **Identity and onboarding:** verified client identity, KYC workflow, suitability/appropriateness, risk disclosures and signed agreements.
2. **Broker ledger:** double-entry accounting for deposits, withdrawals, fees, commissions, realised P/L, unrealised P/L, margin and adjustments. Immutable audit trail.
3. **Client-money controls:** segregated accounts, payment reconciliation, maker-checker approvals, withdrawal verification and daily safeguarding reconciliation.
4. **Trading gateway:** broker-authorised order routing, execution reports, idempotency, order lifecycle state machine, rejects, partial fills, cancel/replace and trade corrections.
5. **Risk engine:** pre-trade margin checks, exposure limits, margin call/stop-out, negative balance protection and kill switches.
6. **Pricing:** licensed market data, executable bid/ask, spread/commission schedule, quote-age checks and stale-price rejection.
7. **Operations console:** client/account controls, trade surveillance, reconciliations, exceptions, complaints, reporting and role-based access.
8. **Security:** MFA, encryption, secrets management, least privilege, secure SDLC, penetration testing and incident response.
9. **Reporting:** client statements, confirmations, costs/charges, transaction history, regulatory returns and management reporting.

### Release gates
- **Gate A — software/demo:** simulated trading only; no client deposits or real execution.
- **Gate B — corporate and regulatory preparation:** company, capital plan, management, policies, counterparties and application pack.
- **Gate C — approval and integration:** CMA licence granted, platform and counterparties approved/contracted, client-money arrangements verified, operational testing completed.
- **Gate D — controlled launch:** only after written legal/compliance sign-off and all regulatory conditions are met.

No UI label, API route or marketing copy may imply that HikeyFX is licensed, holds client funds, offers live trading or has an execution partner before those statements are true.

## 5. Immediate execution sequence

1. Engage a Kenyan advocate experienced in CMA licensing and a qualified audit/accounting adviser.
2. Request a pre-application meeting / written clarification from CMA on the current non-dealing broker checklist, 2025 general licensing requirements, current fees, capital evidence and platform-recognition expectations.
3. Confirm whether the founders can meet the KES 30m paid-up capital and ongoing liquid-capital thresholds.
4. Incorporate the Kenyan limited company only after legal review of the proposed name, shareholding and constitutional documents.
5. Recruit or contract the qualified CEO and required control-function personnel.
6. Select platform and liquidity/execution providers; secure conditional letters and draft SLAs.
7. Complete the policies, business plan, three-year forecasts, governance documents and application forms.
8. Submit through the CMA's official eCitizen licensing portal and respond to all CMA requests.
9. Keep the product demo-only until the licence is granted and all launch conditions are satisfied.

## 6. Official source register

- CMA licensee register: https://licensees.cma.or.ke/
- CMA licensing checklists: https://www.cma.or.ke/licensing/
- CMA regulations: https://www.cma.or.ke/tbuilder-layout-part/regulatory-framework-regulations/
- CMA online application portal: https://cma.ecitizen.go.ke/
- Online Forex Trading Regulations 2017 (CMA PDF): https://cma.or.ke/wp-content/uploads/2023/03/Capital-Markets-Online-Foreign-Exchange-Trading-Regulations-2017.pdf
- Online Forex Trading Amendment Regulations 2023: https://www.cma.or.ke/wpfd_file/the-capital-markets-online-foreign-exchange-trading-amendment-regulations-2023/
- CMA online forex broker checklist PDF: https://www.cma.or.ke/download/39/licensing-checklists2/4371/online-forex-brokers.pdf
- Kenya company registration information: https://brs.go.ke/

**Last reviewed:** 24 November 2026. Reconfirm every legal, capital, fee and licensing requirement with CMA and Kenyan counsel immediately before acting.
