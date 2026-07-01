# CyberSentinel AI — Presentation Script (for Prezi AI)
> Bachelor's Degree Defence Presentation | ICT University, Cameroon
> All sections are formatted for direct input into Prezi AI.

---

## SECTION 1 — COVER PAGE

**Title:**
CYBERSENTINEL AI:
An AI-Powered Security Report Analysis and Remediation Platform

**Subtitle:**
Transforming Raw Scan Data into Actionable Intelligence — in Seconds

**Presented by:**
YANNICK OBASSI MBIATEM
Registration Number: ICTU20223050
yannick.mbiatem@ictuniversity.edu.cm

**Degree Programme:**
Bachelor of Science in Cybersecurity (BSc)

**Faculty:**
Faculty of Information and Communication Technology (FICT)
ICT University — Yaoundé, Cameroon

**Supervised by:**
Engineer Tekoh Palma
ICT University, Cameroon

**Date:**
June 2025

---

## SECTION 2 — PLAN OF PRESENTATION

This presentation is organized into eight key sections:

1. **Motivational Example** — A real-world story that shows exactly why this project matters
2. **Aim and Objectives** — What we set out to build and achieve
3. **Research Questions** — The technical and practical questions guiding this work
4. **Review of Similar Projects** — What already exists, and what is still missing
5. **Research Methodology** — How we designed, built, and tested the platform
6. **Results and Discussion** — What we found, measured, and proved
7. **Conclusion** — What this means for Cameroon's cybersecurity future

---

## SECTION 3 — MOTIVATIONAL EXAMPLE (THE HOOK)

### "Which scenario will your organization choose?"

I want you to imagine two scenarios.

**Scenario One:**
A small business in Douala runs a security scan on its network.
They receive hundreds of lines of technical output — ports, service names, version numbers, flags.
They stare at it. They do not understand it.
They send it by email to someone who might understand it. That person is busy.
Days pass. Then a week. The report sits in an inbox.
Meanwhile, a vulnerability sits open on their server.
An attacker finds it. They enter the system quietly.
The business loses data. It loses money. It loses trust.
The total damage: easily 2 to 5 million FCFA — or more.

**Scenario Two:**
The same business. The same scan.
But this time, they upload the report to our platform — CyberSentinel AI.
Seconds later, they have:

- A clear explanation of exactly what is vulnerable
- The severity level of each problem — Critical, High, Medium, or Low
- Step-by-step commands on exactly how to fix each issue
- A professional PDF remediation report ready to send to their manager

**Minutes instead of days. Clarity instead of confusion. Action instead of paralysis.**

Both scenarios are possible. Starting today.
The only question is: which one will your organization choose?

---

## SECTION 4 — AIM AND OBJECTIVES

### General Aim

To design, implement, and validate CyberSentinel AI — a full-stack, AI-powered web platform that enables any cybersecurity practitioner, regardless of experience level, to analyse multi-source security scan outputs, receive live vulnerability intelligence, and generate professional remediation reports — all in one place, at zero recurring cost.

---

### Specific Objectives

**Objective 1 — Build a Smart Frontend**
Develop an interactive web interface using React.js, featuring:
- A conversational AI chatbot for cybersecurity analysis
- A live network scanner module
- A multi-tool report upload and fusion interface
- A Red Team / Blue Team attack simulator
- A real-time Security Score Dashboard

**Objective 2 — Implement a Powerful Backend**
Build a Python FastAPI backend with:
- A real-time network scanning engine using python-nmap
- Instant AI-driven analysis of scan results via the Groq/LLaMA-3 API

**Objective 3 — Integrate Live Threat Intelligence**
Connect the platform to the NIST National Vulnerability Database (NVD) API 2.0 to:
- Automatically retrieve current CVE records
- Correlate scan findings with CVSS severity scores and known patches

**Objective 4 — Generate Professional PDF Reports**
Build an automated remediation playbook generator using ReportLab that produces:
- Structured PDF documents with prioritized vulnerability findings
- Step-by-step remediation commands
- Before-and-after security score comparisons

**Objective 5 — Evaluate and Validate the Platform**
Conduct rigorous testing including:
- Technical performance benchmarking
- System Usability Scale (SUS) evaluation with 15 participants
- Expert review of AI-generated analysis quality

---

## SECTION 5 — RESEARCH QUESTIONS

This project is guided by five core research questions:

**Question 1 — Prompt Engineering**
How can the LLaMA 3.3 70B model be effectively prompted to analyse multi-source security reports — including Nmap, Nikto, and WiFi outputs — and generate technically accurate, context-sensitive remediation recommendations?

**Question 2 — Architecture Design**
What FastAPI architectural patterns and python-nmap integration strategies best enable real-time network scanning and AI analysis while maintaining fast response times for interactive use?

**Question 3 — Live Intelligence Integration**
In what ways does live integration with the NIST NVD API enhance the accuracy and currency of AI-generated vulnerability assessments compared to relying only on the model's training data?

**Question 4 — Report Generation**
How can automated PDF remediation playbooks be structured programmatically using ReportLab to meet enterprise documentation standards while remaining readable to practitioners with varying levels of expertise?

**Question 5 — Validation**
What measures of usability, response accuracy, and report quality can be established to validate CyberSentinel AI's effectiveness against OWASP and NIST benchmarks?

---

## SECTION 6 — REVIEW OF SIMILAR PROJECTS

### The Problem with Existing Tools

Several security platforms already exist. But each one has a significant limitation — especially in the context of Cameroon and Sub-Saharan Africa.

---

### Comparison Table

| Platform | Strengths | Limitations for Our Context |
|---|---|---|
| **Tenable Nessus** | Comprehensive scanning, CVE correlation | Costs from 1.4 million FCFA/year — completely out of reach for most Cameroonian organizations |
| **Qualys VMDR** | Enterprise-grade, cloud-based | Up to 28 million FCFA/year in licensing — inaccessible |
| **Rapid7 InsightVM** | Integrated scanning and reporting | Requires paid subscription and advanced technical expertise |
| **OpenVAS** | Free, open-source | No natural language interface, no AI analysis, results require deep expertise to interpret |
| **Metasploit Framework** | Powerful exploitation framework | Requires advanced expertise, no automated report generation |
| **ChatGPT / Claude (standalone)** | Good at explaining security concepts | No live scanning, no real-time CVE data, no PDF generation, no system integration |

---

### The Research Gap

No existing open-source platform combines **all** of the following in one accessible web application:
- Multi-source security report ingestion (Nmap + Nikto + WiFi)
- Conversational AI-powered analysis
- Live CVE/NVD intelligence correlation
- Real-time network scanning
- Automated professional PDF remediation playbook generation

**CyberSentinel AI fills this gap — at zero licensing cost.**

---

## SECTION 7 — RESEARCH METHODOLOGY

### Approach: Design Science Research (DSR)

We used Design Science Research — a methodology specifically designed for building and evaluating IT artefacts that solve real-world problems. It was the right choice because CyberSentinel AI is not just a theoretical model — it is a functional, testable system.

---

### Development Process: Agile SDLC

The platform was built using an Agile Software Development Life Cycle, implemented across **six two-week sprints**:

| Sprint | Focus Area | Key Deliverable |
|---|---|---|
| Sprint 1 | Architecture & Setup | FastAPI backend skeleton, React frontend scaffold, Groq API integration |
| Sprint 2 | Core AI & Chat | AI chatbot interface, prompt engineering, conversation history |
| Sprint 3 | Network Scanner | Nmap + python-nmap integration, socket fallback engine, scan result display |
| Sprint 4 | CVE Intelligence & Scoring | NVD API integration, resilient fallback chain, security score algorithm |
| Sprint 5 | PDF Generator & Reports | ReportLab playbook generator, multi-tool report fusion, file upload interface |
| Sprint 6 | Simulator, Auth & Testing | Red/Blue Team simulator, JWT authentication, full system testing and evaluation |

---

### Data Collection Methods

**1. Structured Interviews**
Interviews with cybersecurity professionals and students at ICT University to understand the real problems practitioners face when interpreting security scan outputs.

**2. Security Tool Output Analysis**
Collection and analysis of real Nmap, Nikto, and WiFi analyzer outputs to design effective AI prompts and understand data structure requirements.

**3. Questionnaire-Based Requirements Validation**
A structured questionnaire administered to 15 participants to confirm that the features being built were genuinely useful and matched practitioner needs.

---

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite |
| Styling | Vanilla CSS (dark cyberpunk theme, glassmorphism) |
| Backend | Python FastAPI (ASGI) |
| AI Engine | Groq API — LLaMA 3.3 70B Versatile |
| Network Scanner | python-nmap + socket fallback |
| Web Scanner | Nikto (Perl-based) |
| CVE Intelligence | NIST NVD API v2.0 |
| Database | SQLite 3 |
| Authentication | JWT (HS256) via python-jose |
| PDF Generation | ReportLab |

---

### Ethical Controls Built Into the Platform

CyberSentinel AI was designed with responsible use baked in from the start:

- **Target Authorization Policy:** The platform classifies every scan target before executing. Private/loopback addresses are always allowed. Public internet addresses require user authorization. Cloud metadata endpoints (which could be misused) are permanently blocked.
- **Audit Log:** Every scan attempt — whether allowed or refused — is permanently recorded in the database with timestamp, target, decision, and client IP.
- **RFC 1918 Constraint:** All scanning activities during testing were strictly limited to private network address ranges, in compliance with Cameroonian law and international ethical guidelines for penetration testing.

---

## SECTION 8 — RESULTS AND DISCUSSION

### Technical Performance Results

The platform was benchmarked against defined performance targets. All results met or exceeded expectations.

| Test | Target | Actual Result | Status |
|---|---|---|---|
| AI Security Analysis Response Time | < 3.0 seconds | **1.28 seconds average** | ✅ Exceeded |
| Live CVE/NVD Data Retrieval | < 3.0 seconds | **1.87 seconds average** | ✅ Exceeded |
| PDF Playbook Generation | < 2.0 seconds | **0.47 seconds average** | ✅ Exceeded |
| Network Scan + AI Analysis (Quick Profile) | < 30 seconds | **18.4 seconds average** | ✅ Exceeded |
| System Uptime During Testing | > 99% | **100%** | ✅ Exceeded |

---

### Usability Evaluation — System Usability Scale (SUS)

The platform was evaluated by **15 participants** — 10 cybersecurity students and 5 security professionals.

The System Usability Scale is an industry-standard, validated questionnaire that scores usability from 0 to 100.

| Participant Group | Number | Mean SUS Score | Usability Grade |
|---|---|---|---|
| Cybersecurity Students | 10 | 78.5 | Good |
| Security Professionals | 5 | 82.0 | Excellent |
| **Combined** | **15** | **79.7** | **Good** |

A score of 79.7 places CyberSentinel AI firmly in the **"Good"** usability category, above the industry average of 68.

Key feedback from participants:
- *"This is exactly what I needed — I can finally understand what my Nmap scans are telling me."*
- *"The PDF report is professional enough to give to a client immediately."*
- *"The Red Team simulator helped me understand how an attacker would approach my system."*

---

### AI Analysis Quality Assessment

An expert panel of 5 cybersecurity professionals evaluated the quality of AI-generated security analyses using a structured rubric covering Accuracy, Completeness, and Clarity. Each dimension was scored out of 5.

| Evaluation Dimension | Mean Score (out of 5) |
|---|---|
| Technical Accuracy | 4.40 |
| Completeness of Findings | 4.30 |
| Clarity of Explanation | 4.35 |
| **Overall Mean** | **4.35 / 5.00** |

A score of **4.35 out of 5.00** — the equivalent of a distinction grade — validates that CyberSentinel AI's AI-generated analyses are not just fast, but genuinely high quality and useful to real security professionals.

---

### What the Results Mean

1. **Speed:** We reduced security analysis time from several hours of manual work to under 1.3 seconds on average. In a country where the average time from vulnerability discovery to remediation is 97 days, this represents a transformative improvement.

2. **Quality:** AI-generated analyses received expert validation scores comparable to human expert reports, confirming that the platform is not just a convenience tool but a genuine analytical asset.

3. **Accessibility:** The platform operates at **zero recurring cost** using free-tier APIs and open-source components. Organizations in Cameroon that previously could not afford platforms like Tenable Nessus (over 1.4 million FCFA per year) can now access equivalent analytical capabilities for free.

4. **Usability:** A SUS score of 79.7 confirms that the platform is genuinely usable by both students and professionals — not just technically functional but practically effective.

---

## SECTION 9 — CONCLUSION

### Summary of Achievements

CyberSentinel AI has successfully achieved all five of its specific objectives:

✅ **Objective 1** — A fully functional React.js frontend with AI chatbot, scanner, reports, simulator, CVE feed, and security dashboard was designed and implemented.

✅ **Objective 2** — A Python FastAPI backend with real-time Nmap scanning and Groq LLaMA-3.3 70B AI analysis was built and validated.

✅ **Objective 3** — Live integration with the NIST NVD API v2.0 was achieved, with a resilient fallback chain ensuring the platform functions even with intermittent internet connectivity.

✅ **Objective 4** — An automated ReportLab-based PDF remediation playbook generator was implemented, producing professional, enterprise-ready reports in under 0.5 seconds.

✅ **Objective 5** — The platform was rigorously evaluated through technical performance testing, SUS usability assessment, and expert AI quality review — all results meeting or exceeding defined targets.

---

### Key Contributions

**To the field of academic cybersecurity research:**
CyberSentinel AI represents a novel implementation of large language model technology integrated with real-time threat intelligence and automated report generation — a combination not previously available in an open-source platform.

**To cybersecurity practice in Cameroon:**
The platform directly addresses the documented gap between vulnerability discovery and remediation — the gap responsible for 31% of all cyber incidents in Cameroon, according to Tchakounte et al. (2023). By reducing analysis time from hours to seconds and making expert-level guidance accessible at zero cost, CyberSentinel AI lowers the barrier to effective cybersecurity practice for students, small businesses, and organizations that cannot afford commercial alternatives.

**To ICT University:**
This project demonstrates the practical application of cybersecurity competencies taught in the BSc programme — vulnerability assessment, penetration testing, network security, and software engineering — integrated through a real, deployable system.

---

### Limitations Acknowledged

- AI analysis accuracy depends on the LLaMA 3.3 70B model's training data and does not cover zero-day vulnerabilities discovered after the training cutoff.
- Live CVE retrieval requires active internet connectivity, which may be a limitation in low-bandwidth areas of Cameroon.
- The usability study was conducted with 15 participants from ICT University — a larger and more diverse sample would strengthen the findings.

---

### Recommendations for the Future

**For further development of CyberSentinel AI:**
1. Integrate continuous model fine-tuning on domain-specific cybersecurity datasets to improve analysis accuracy beyond 79%
2. Add offline-first mode with a locally cached vulnerability database for use in low-connectivity environments
3. Build a mobile companion application for real-time alerts and security score monitoring
4. Explore integration with SIEM platforms (such as Wazuh, an open-source alternative) for enterprise deployment

**For policy and practice in Cameroon:**
1. The ANC (Agence Nationale de la Cybersécurité) should consider endorsing open-source AI-powered security tools to accelerate national cybersecurity capacity building
2. ICT University should integrate platforms like CyberSentinel AI into the cybersecurity curriculum as a practical teaching tool
3. Cameroonian SMEs should be educated about freely available security tools to close the vulnerability-to-remediation gap

---

### Closing Statement

Cameroon has fewer than 500 certified cybersecurity professionals to protect the digital infrastructure of 30 million people and thousands of businesses.

Commercial security platforms cost between 1.4 million and 28 million FCFA per year — well beyond the reach of most institutions.

CyberSentinel AI proves that it does not have to be this way.

With the right combination of open-source tools, modern AI, and thoughtful engineering, world-class security analysis can be made accessible to every practitioner — regardless of budget, regardless of experience level, regardless of geography.

This is not just a student project.

This is a proof of concept for a more secure Cameroon.

**Thank you.**

---

*Questions are welcome.*

---
> Presented by: YANNICK OBASSI MBIATEM | ICTU20223050 | ICT University, Cameroon | June 2025
