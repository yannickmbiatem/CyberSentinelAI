/**
 * CyberSentinel AI — Online Safety Survey (General Public version)
 * Auto-generates a complete Google Form.
 *
 * HOW TO RUN:
 *   1. Go to https://script.google.com  →  "New project"
 *   2. Delete any sample code, paste THIS whole file.
 *   3. Click Save (disk icon), then Run ▶ the function "createCyberSentinelForm".
 *   4. Approve the permission prompt (it only lets the script create a form for you).
 *   5. Open View → Logs (or Execution log). The form's edit link is printed there.
 *
 * The form is created in your Google Drive. Open it, review, then click "Send".
 */

function createCyberSentinelForm() {
  // Reusable Likert scale for grid questions
  var LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  // ── Create the form ─────────────────────────────────────────────────────────
  var form = FormApp.create('CyberSentinel AI — Online Safety Survey');
  form.setDescription(
    'This short survey is part of a university research project on staying safe online. ' +
    'It asks about your experience with the internet and online dangers (Part 1), and your ' +
    'opinion of a new safety assistant called CyberSentinel AI after you see it demonstrated (Part 2). ' +
    'No technical knowledge is needed. All answers are anonymous and used only for this research. ' +
    'Estimated time: 5 minutes.'
  );
  form.setProgressBar(true);
  form.setCollectEmail(false);

  // ── SECTION A — About You ─────────────────────────────────────────────────────
  form.addSectionHeaderItem().setTitle('Section A — About You');

  form.addMultipleChoiceItem()
    .setTitle('What is your age group?')
    .setChoiceValues(['Under 18', '18–24', '25–34', '35–44', '45 and above'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How often do you use a smartphone or the internet?')
    .setChoiceValues(['Many times a day', 'Once a day', 'A few times a week', 'Rarely'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('What do you mainly use the internet for?')
    .setChoiceValues([
      'Social media (WhatsApp, Facebook, TikTok, etc.)',
      'Messaging / calls',
      'Mobile money or online banking',
      'Email',
      'Shopping / business',
      'Studies / work'
    ])
    .showOtherOption(true);

  form.addScaleItem()
    .setTitle('How comfortable are you with technology in general?')
    .setBounds(1, 5)
    .setLabels('Not comfortable', 'Very comfortable');

  // ── SECTION B — Your Experience With Online Dangers ──────────────────────────
  form.addSectionHeaderItem().setTitle('Section B — Your Experience With Online Dangers');

  form.addCheckboxItem()
    .setTitle('Have you, or someone you know, ever experienced any of these?')
    .setChoiceValues([
      'A social media or email account was hacked',
      'Received a fake message or call trying to trick you (scam / phishing)',
      'Lost money through online or mobile-money fraud',
      'A phone or computer infected by a virus',
      'A password stolen or guessed',
      'None of these',
      'Not sure'
    ])
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How worried are you about online dangers (scams, hacking, fraud)?')
    .setBounds(1, 5)
    .setLabels('Not worried', 'Very worried');

  form.addGridItem()
    .setTitle('How much do you agree with the following?')
    .setRows([
      'Online scams and hacking are a serious problem where I live.',
      'I don\'t really know how to protect myself online.',
      'Security advice I find online is too technical to understand.',
      'I wish something could explain online safety in simple words.',
      'I would feel safer with help that warns me about new dangers.'
    ])
    .setColumns(LIKERT)
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('What do you currently do to stay safe online?')
    .setChoiceValues([
      'Use strong passwords',
      'Use antivirus software',
      'Use two-step verification (code by SMS/app)',
      'Ask a friend or family member for help',
      'I\'m careful about suspicious messages',
      'I don\'t really do anything',
      'I don\'t know how'
    ])
    .showOtherOption(true);

  form.addScaleItem()
    .setTitle('How confident are you that you can protect yourself online today?')
    .setBounds(1, 5)
    .setLabels('Not confident', 'Very confident');

  // ── SECTION C — Your View on Technology Help & AI ────────────────────────────
  form.addSectionHeaderItem().setTitle('Section C — Your View on Technology Help & AI');

  form.addMultipleChoiceItem()
    .setTitle('Have you ever used an AI assistant (like ChatGPT or a chatbot)?')
    .setChoiceValues([
      'Yes, often',
      'Yes, a few times',
      'No, but I\'ve heard of them',
      'No, never'
    ]);

  form.addGridItem()
    .setTitle('How much do you agree?')
    .setRows([
      'An assistant that explains online safety in simple language would be helpful.',
      'I would trust advice from such a tool if it was easy to understand.',
      'I prefer simple explanations over technical ones.',
      'A tool like this could help people who are not "tech experts."'
    ])
    .setColumns(LIKERT);

  // ── SECTION D — The Idea Behind CyberSentinel AI ─────────────────────────────
  form.addSectionHeaderItem()
    .setTitle('Section D — The Idea Behind CyberSentinel AI')
    .setHelpText(
      'CyberSentinel AI is like a smart safety assistant. It can check whether your devices ' +
      'and network are safe, warn you about new online dangers, answer your security questions ' +
      'in plain language, and tell you in simple steps how to fix problems.'
    );

  form.addScaleItem()
    .setTitle('How useful would a tool like this be for you?')
    .setBounds(1, 5)
    .setLabels('Not useful', 'Very useful');

  form.addCheckboxItem()
    .setTitle('Which of these benefits would matter most to you?')
    .setChoiceValues([
      'Explaining online dangers in simple words',
      'Warning me about the latest scams and threats',
      'Telling me how to fix a problem step by step',
      'Checking if my devices/network are safe',
      'Helping me create a simple safety report',
      'Answering my questions anytime'
    ]);

  // ── PAGE BREAK → Part 2 ──────────────────────────────────────────────────────
  form.addPageBreakItem()
    .setTitle('Part 2 — After the Demonstration')
    .setHelpText('Please answer the rest after seeing the CyberSentinel AI demonstration.');

  // ── SECTION E — Your Impression After Seeing It ──────────────────────────────
  form.addSectionHeaderItem().setTitle('Section E — Your Impression After Seeing It');

  form.addGridItem()
    .setTitle('How much do you agree?')
    .setRows([
      'The tool was easy to understand.',
      'It explained things in language I could follow.',
      'It looked professional and trustworthy.',
      'It was easy to use, even without technical knowledge.',
      'I would feel more confident about online safety using a tool like this.',
      'I would be able to use it on my own without much help.'
    ])
    .setColumns(LIKERT)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Was anything confusing or hard to understand?');

  // ── SECTION F — Overall ──────────────────────────────────────────────────────
  form.addSectionHeaderItem().setTitle('Section F — Overall');

  form.addScaleItem()
    .setTitle('Overall, what is your impression of CyberSentinel AI?')
    .setBounds(1, 5)
    .setLabels('Very poor', 'Excellent')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How likely are you to recommend it to family or friends?')
    .setBounds(0, 10)
    .setLabels('Not at all likely', 'Extremely likely');

  form.addMultipleChoiceItem()
    .setTitle('Do you think a tool like this would be useful for people in Cameroon?')
    .setChoiceValues([
      'Yes, very useful',
      'Somewhat useful',
      'Not sure',
      'Not really useful'
    ]);

  form.addParagraphTextItem().setTitle('What did you like most?');
  form.addParagraphTextItem().setTitle('What would you change or add?');
  form.addParagraphTextItem().setTitle('Any other comments?');

  // ── Done — print the links ───────────────────────────────────────────────────
  Logger.log('✅ Form created successfully!');
  Logger.log('Edit (you):   ' + form.getEditUrl());
  Logger.log('Share (them): ' + form.getPublishedUrl());
}
