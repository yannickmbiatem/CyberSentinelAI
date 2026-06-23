"""
pdf_generator.py — Professional remediation playbook PDF generation using ReportLab
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from io import BytesIO
from datetime import datetime


def generate_remediation_pdf(vulnerabilities: list[dict], target: str, analyst: str = "CyberSentinel AI") -> bytes:
    """
    Generate a professional remediation playbook PDF.

    Args:
        vulnerabilities: List of vulnerability dicts with keys:
            name, severity (CRITICAL/HIGH/MEDIUM/LOW), cve (optional),
            description, fix, command (optional), priority (int)
        target: Target system name/IP
        analyst: Name of analyst/tool

    Returns:
        PDF as bytes
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm
    )

    # ── Colors ────────────────────────────────────────────────────────────────
    COLOR_BG_DARK = HexColor('#0a0e17')
    COLOR_BG_CARD = HexColor('#1a2332')
    COLOR_ACCENT = HexColor('#00f0ff')
    COLOR_RED = HexColor('#ff3366')
    COLOR_ORANGE = HexColor('#ff8c00')
    COLOR_GREEN = HexColor('#00ff88')
    COLOR_YELLOW = HexColor('#ffd700')
    COLOR_TEXT = HexColor('#e2e8f0')
    COLOR_MUTED = HexColor('#94a3b8')
    COLOR_BORDER = HexColor('#1e293b')

    SEVERITY_COLORS = {
        "CRITICAL": HexColor('#dc2626'),
        "HIGH": HexColor('#ea580c'),
        "MEDIUM": HexColor('#ca8a04'),
        "LOW": HexColor('#16a34a'),
        "INFO": HexColor('#2563eb'),
        "UNKNOWN": HexColor('#6b7280'),
    }

    # ── Styles ────────────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CyberTitle', fontSize=22, textColor=COLOR_ACCENT,
        fontName='Helvetica-Bold', spaceAfter=4, alignment=TA_CENTER
    )
    subtitle_style = ParagraphStyle(
        'CyberSubtitle', fontSize=11, textColor=COLOR_MUTED,
        fontName='Helvetica', spaceAfter=2, alignment=TA_CENTER
    )
    section_style = ParagraphStyle(
        'CyberSection', fontSize=13, textColor=COLOR_ACCENT,
        fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=6, borderPad=4
    )
    body_style = ParagraphStyle(
        'CyberBody', fontSize=9, textColor=HexColor('#d1d5db'),
        fontName='Helvetica', leading=13, spaceAfter=4
    )
    code_style = ParagraphStyle(
        'CyberCode', fontSize=8, textColor=COLOR_GREEN,
        fontName='Courier', leading=11, backColor=COLOR_BG_DARK,
        leftIndent=8, rightIndent=8, borderPad=4, spaceAfter=6, spaceBefore=2
    )
    label_style = ParagraphStyle(
        'CyberLabel', fontSize=8, textColor=COLOR_MUTED,
        fontName='Helvetica-Bold', spaceAfter=2
    )

    story = []

    # ── Cover Header ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("CyberSentinel AI", title_style))
    story.append(Paragraph("Security Remediation Playbook", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_ACCENT, spaceAfter=8))

    # Meta info table
    now = datetime.now().strftime("%B %d, %Y at %H:%M")
    meta_data = [
        [Paragraph("Target System:", label_style), Paragraph(target, body_style),
         Paragraph("Generated:", label_style), Paragraph(now, body_style)],
        [Paragraph("Analyst:", label_style), Paragraph(analyst, body_style),
         Paragraph("Total Issues:", label_style), Paragraph(str(len(vulnerabilities)), body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[3 * cm, 6 * cm, 3 * cm, 5.5 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_CARD),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.4 * cm))

    # ── Summary Table ─────────────────────────────────────────────────────────
    story.append(Paragraph("Vulnerability Summary", section_style))

    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for v in vulnerabilities:
        sev = v.get("severity", "LOW").upper()
        if sev in counts:
            counts[sev] += 1

    summary_data = [["#", "Vulnerability", "Severity", "CVE", "Priority"]]
    for i, vuln in enumerate(vulnerabilities, 1):
        sev = vuln.get("severity", "UNKNOWN").upper()
        summary_data.append([
            str(i),
            vuln.get("name", "Unknown")[:55],
            sev,
            vuln.get("cve", "N/A"),
            f"P{vuln.get('priority', i)}"
        ])

    summary_table = Table(summary_data, colWidths=[0.8 * cm, 9 * cm, 2.2 * cm, 3 * cm, 1.5 * cm])

    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_BG_CARD),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLOR_ACCENT),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#111827'), HexColor('#0a0e17')]),
    ]

    # Color-code severity cells
    for row_idx, vuln in enumerate(vulnerabilities, 1):
        sev = vuln.get("severity", "UNKNOWN").upper()
        color = SEVERITY_COLORS.get(sev, HexColor('#6b7280'))
        table_style.append(('TEXTCOLOR', (2, row_idx), (2, row_idx), color))
        table_style.append(('FONTNAME', (2, row_idx), (2, row_idx), 'Helvetica-Bold'))

    summary_table.setStyle(TableStyle(table_style))
    story.append(summary_table)
    story.append(Spacer(1, 0.3 * cm))

    # ── Severity Count Bar ────────────────────────────────────────────────────
    count_data = [[
        Paragraph(f"CRITICAL: {counts['CRITICAL']}", ParagraphStyle('c', fontSize=9, textColor=SEVERITY_COLORS['CRITICAL'], fontName='Helvetica-Bold')),
        Paragraph(f"HIGH: {counts['HIGH']}", ParagraphStyle('h', fontSize=9, textColor=SEVERITY_COLORS['HIGH'], fontName='Helvetica-Bold')),
        Paragraph(f"MEDIUM: {counts['MEDIUM']}", ParagraphStyle('m', fontSize=9, textColor=SEVERITY_COLORS['MEDIUM'], fontName='Helvetica-Bold')),
        Paragraph(f"LOW: {counts['LOW']}", ParagraphStyle('l', fontSize=9, textColor=SEVERITY_COLORS['LOW'], fontName='Helvetica-Bold')),
    ]]
    count_table = Table(count_data, colWidths=[4.25 * cm] * 4)
    count_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_CARD),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ]))
    story.append(count_table)
    story.append(Spacer(1, 0.5 * cm))

    # ── Detailed Remediation Steps ────────────────────────────────────────────
    story.append(Paragraph("Detailed Remediation Steps", section_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER, spaceAfter=8))

    for i, vuln in enumerate(vulnerabilities, 1):
        sev = vuln.get("severity", "UNKNOWN").upper()
        sev_color = SEVERITY_COLORS.get(sev, HexColor('#6b7280'))
        name = vuln.get("name", "Unknown Vulnerability")
        cve = vuln.get("cve", "")
        description = vuln.get("description", "No description available.")
        fix = vuln.get("fix", "No remediation provided.")
        command = vuln.get("command", "")
        priority = vuln.get("priority", i)

        # Vulnerability header
        header_data = [[
            Paragraph(f"#{i}  {name}", ParagraphStyle('vh', fontSize=10, textColor=white, fontName='Helvetica-Bold')),
            Paragraph(f"{sev}", ParagraphStyle('vs', fontSize=9, textColor=sev_color, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        ]]
        header_table = Table(header_data, colWidths=[13 * cm, 4.5 * cm])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_CARD),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (0, 0), 8),
            ('RIGHTPADDING', (-1, 0), (-1, 0), 8),
            ('LINEBELOW', (0, 0), (-1, 0), 1, sev_color),
        ]))

        details = []
        if cve:
            details.append(Paragraph(f"CVE: {cve}", label_style))
        details.append(Paragraph(f"Priority: P{priority}", label_style))
        details.append(Spacer(1, 0.1 * cm))
        details.append(Paragraph(description, body_style))
        details.append(Spacer(1, 0.1 * cm))
        details.append(Paragraph("Remediation:", ParagraphStyle('rl', fontSize=9, textColor=COLOR_ACCENT, fontName='Helvetica-Bold')))
        details.append(Paragraph(fix, body_style))

        if command:
            details.append(Paragraph(f"$ {command}", code_style))

        detail_table = Table([[details]], colWidths=[17.5 * cm])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#0d1117')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ]))

        block = KeepTogether([header_table, detail_table, Spacer(1, 0.3 * cm)])
        story.append(block)

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceBefore=12, spaceAfter=8))
    story.append(Paragraph(
        "This report was generated by CyberSentinel AI for educational purposes. "
        "Always verify findings with a qualified security professional before implementing changes in production environments. "
        "Only test systems you own or have explicit written authorization to test.",
        ParagraphStyle('footer', fontSize=7, textColor=COLOR_MUTED, fontName='Helvetica-Oblique', alignment=TA_CENTER)
    ))

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
