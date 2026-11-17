/**
 * All page copy lives here. Each tool page has its own wording on purpose: search engines ignore
 * pages that are copies of each other with one word swapped.
 * Text is HTML. Keep facts true to what the software does (see README "Honest limits").
 */

const steps = items => `<div class="steps">${items.map(([title, body], i) => `<article><span class="step-number">0${i + 1}</span><h3>${title}</h3><p>${body}</p></article>`).join('')}</div>`;
const block = (heading, paragraphs) => `<div class="prose-block"><h2>${heading}</h2>${paragraphs.map(p => `<p>${p}</p>`).join('')}</div>`;

export const tools = [
  { path: '', name: 'AI detector', blurb: 'Score any text for AI-like patterns, with the reasons shown sentence by sentence.' },
  { path: 'ai-humanizer', name: 'AI humanizer', blurb: 'Turn stiff, machine-sounding wording into natural writing and see every change.' },
  { path: 'grammar-checker', name: 'Grammar checker', blurb: 'Fix spelling, spacing, capitals and common grammar slips.' },
  { path: 'text-simplifier', name: 'Text simplifier', blurb: 'Rewrite dense text in shorter words and sentences.' },
  { path: 'summarizer', name: 'Summarizer', blurb: 'Cut a long passage down to its main points.' },
  { path: 'word-counter', name: 'Word counter', blurb: 'Live counts of words, characters, sentences and reading time in any language.' }
];

export const pages = [
  /* ------------------------------------------------------------------ home */
  {
    path: '', kind: 'tool', action: 'detect', priority: '1.0',
    title: 'Free AI Detector: No Sign-Up, Sentence-Level Reasons',
    description: 'Check up to 30,000 characters for AI-like writing with no sign-up. See the score, the reasons and the flagged sentences. Your text stays in your browser.',
    eyebrow: 'FREE · NO SIGN-UP · NOTHING UPLOADED',
    h1: 'Free AI detector<br>that <em>shows its reasons.</em>',
    lead: 'Paste up to 30,000 characters, about 5,000 words, and get an AI-likeness score with the signals behind it and the sentences that drove it. Then humanize, proofread, simplify or summarize the same text.',
    sections: `
<section id="how-it-works" class="section">
  <p class="eyebrow">THREE STEPS</p>
  <h2>From text to a clear picture.</h2>
  ${steps([
    ['Bring your words', 'Paste, type or open a .txt, .md, .docx or .pdf file. Files are read on your device and are not uploaded.'],
    ['Check the score', 'You get a 0–100 AI-likeness score, ten explained signals and a view of which sentences drove it.'],
    ['Improve the text', 'Humanize, fix grammar, simplify or summarize. Every change is shown against your original before you copy it.']
  ])}
</section>
<section class="section">
  <p class="eyebrow">WHY THIS ONE</p>
  <h2>Built for people who need to see the working.</h2>
  <div class="feature-grid">
    <article><h3>No account, no daily cap on scoring</h3><p>Scoring runs in your own browser, so there is nothing to sign up for and no queue.</p></article>
    <article><h3>Long documents in one go</h3><p>30,000 characters per check is enough for most essays, reports and thesis chapters.</p></article>
    <article><h3>Your text is not uploaded for scoring</h3><p>The detector, the word counter and file reading work on your device. Only a model-backed rewrite sends text to a server, and the tool says so first.</p></article>
    <article><h3>Reasons, not just a number</h3><p>Each signal is explained, and you can tap any flagged sentence to see why it stood out.</p></article>
    <article><h3>Hindi and other scripts counted correctly</h3><p>Words and sentences are counted properly in Devanagari and other scripts. There is also a <a href="/hi">Hindi version</a>.</p></article>
    <article><h3>Honest about its limits</h3><p>The score is a rule-based estimate with a stated confidence level. It is never presented as proof.</p></article>
  </div>
</section>
<section id="method" class="section method">
  <div>
    <p class="eyebrow">TRANSPARENCY</p>
    <h2>A useful lens. <em>Never a verdict.</em></h2>
    <p>No tool can prove who wrote a text. This one shows its working so you can judge the score for yourself.</p>
  </div>
  <div class="method-details">
    <h3>How the score is built</h3>
    <p>The detector measures ten writing-style signals: stock phrasing, sentence rhythm, formulaic openers, personal voice, lists of three, trailing “-ing” clauses, punctuation variety, short sentences, concrete detail and paragraph uniformity. Chat-assistant phrases such as “Sure! Here’s a quick…” count as extra evidence. A weighted combination is mapped to a 0–100 scale. It is a rule-based estimate, not a trained classifier.</p>
    <h3>Where it goes wrong</h3>
    <p>Formal, academic or heavily edited human writing can score high. Model output that has been edited by a person can score low. Short passages and languages other than English carry less evidence, so their scores are pulled toward 50 and marked low confidence. Headings and short list items are left out of the sentence statistics.</p>
    <h3>How rewriting works</h3>
    <p>When a language model is connected, rewrites are produced by that model and checked so numbers and links are not altered. If the model is unavailable, the tool falls back to offline rules in your browser and tells you.</p>
    <p class="context-note">Do not use this score alone for academic, hiring or disciplinary decisions.</p>
  </div>
</section>`,
    faqs: [
      ['Can it tell for certain that a text was written by AI?', 'No. The score reflects how closely the writing matches patterns common in model output. It is evidence to weigh, with a stated confidence level, and it is sometimes wrong in both directions.'],
      ['Is my text uploaded?', 'Scoring, counting, file reading and offline rewriting all happen in your browser. Only a model-backed rewrite sends your passage to this site’s server and on to the model provider, and the tool tells you when that mode is active.'],
      ['Why did my own writing get a high score?', 'Formal and academic writing shares many surface features with model output: even sentence lengths, few contractions and tidy lists. Read the signal list to see which features raised the score. A high score is not evidence that you used AI.'],
      ['Which languages and files are supported?', 'Any language can be scored and counted, but the wording signals are tuned for English, so other languages are marked low confidence. You can open .txt, .md and .docx files up to 2 MB and text-based .pdf files up to 10 MB. Scanned PDFs do not contain readable text.'],
      ['What are the limits?', 'Scoring and counting accept up to 30,000 characters. Rewriting accepts 3 to 1,500 words and up to 12,000 characters per request, with a limit of 8 model rewrites a minute.'],
      ['Is it really free?', 'Yes. Scoring and offline tools cost nothing to run. Model-backed rewriting uses a shared free allowance; when that runs out for the day, the offline rules take over.']
    ]
  },

  /* ------------------------------------------------------------- humanizer */
  {
    path: 'ai-humanizer', kind: 'tool', action: 'humanize', priority: '0.9',
    title: 'Free AI Humanizer: Make AI Text Sound Natural',
    description: 'Rewrite stiff, machine-sounding text into natural writing. Free, no sign-up, and every change is shown against your original so you stay in control.',
    eyebrow: 'AI HUMANIZER',
    h1: 'Make AI-sounding text<br><em>read like a person wrote it.</em>',
    lead: 'Paste a draft and get a version with plainer words, varied sentences and less filler. Your original stays beside it, with every change marked.',
    sections: `
<section class="section">
  ${block('What the humanizer changes', [
    'Machine-written drafts tend to share the same habits: openers such as “Furthermore” and “In today’s world”, stock phrases such as “plays a crucial role”, sentences of nearly equal length, and no contractions. The humanizer targets those habits and leaves your meaning, names, numbers, quotations and links alone.',
    'When a language model is connected, it rewrites whole sentences for rhythm and tone, and the result is checked before you see it: if a number or a link changed, or the text drifted off topic, the revision is rejected. When no model is available, a smaller set of offline rules swaps stock phrases, adds contractions and removes filler. The label above the result tells you which one ran.'
  ])}
  ${block('How to get a good result', [
    'Work in sections of a few paragraphs, not a whole document at once. Read the “Changes” view, keep the edits that sound like you and undo the ones that don’t. Then add what no tool can: a specific example, a figure from your own work, an opinion you actually hold. Those details do more for a draft than any rewording.'
  ])}
</section>`,
    faqs: [
      ['Will the humanized text pass AI detectors?', 'There is no such promise. Detectors disagree with each other and none is reliable enough to guarantee an outcome. The aim here is clearer, more natural writing.'],
      ['Does it change my facts or numbers?', 'It is designed not to. Model revisions are rejected automatically if a number or link is altered, and offline rules never touch numbers, links, e-mail addresses or quoted passages. Still compare the result with your original.'],
      ['Is it allowed to use a humanizer for coursework or publications?', 'That depends on the rules of your institution or publisher. Many require you to disclose AI assistance. Check before you submit; the tool cannot make that decision for you.'],
      ['How much text can I humanize at once?', 'Between 3 and 1,500 words, up to 12,000 characters, per request.']
    ]
  },

  /* --------------------------------------------------------------- grammar */
  {
    path: 'grammar-checker', kind: 'tool', action: 'grammar', priority: '0.8',
    title: 'Free Grammar Checker: Fix Spelling and Punctuation',
    description: 'Paste your text to fix spelling, spacing, capital letters and common grammar mistakes. Free, no sign-up, with every correction highlighted.',
    eyebrow: 'GRAMMAR CHECKER',
    h1: 'Fix grammar and spelling<br><em>without losing your voice.</em>',
    lead: 'A proofreading pass that corrects mistakes and leaves correct sentences exactly as you wrote them. Each correction is highlighted so nothing changes behind your back.',
    sections: `
<section class="section">
  ${block('What gets corrected', [
    'The checker repairs the mechanics of a text: doubled spaces, spaces before commas and full stops, missing spaces after punctuation, sentences that start with a small letter, a lone “i”, repeated words such as “the the”, the wrong choice of “a” or “an”, runs of “!!!” or “??”, and several dozen common misspellings such as “recieve” and “definately”.',
    'With a language model connected, it also catches errors that need the whole sentence to judge, such as subject and verb agreement or a wrong tense, and it is instructed to make the fewest changes possible. If the model rewrites more than about a quarter of the wording, the revision is rejected as too heavy for a proofread.'
  ])}
  ${block('What it leaves alone', [
    'Web addresses, e-mail addresses, quoted passages and anything inside backticks are never edited. Names, numbers and dates are kept as written. In languages other than English, only spacing and punctuation are tidied.'
  ])}
</section>`,
    faqs: [
      ['Does it work for British and American spelling?', 'It does not convert between them. Words that are correct in either variety are left as you wrote them.'],
      ['Can it check Hindi text?', 'For Hindi and other non-English text, the offline checker tidies spacing and punctuation only, including the space before a danda. A connected language model can do more.'],
      ['Will it rewrite my sentences?', 'No. Proofreading mode is limited to corrections. Use the humanizer or the simplifier if you want the wording itself changed.'],
      ['Is there a word limit?', '3 to 1,500 words, up to 12,000 characters, per request.']
    ]
  },

  /* ------------------------------------------------------------ simplifier */
  {
    path: 'text-simplifier', kind: 'tool', action: 'simplify', priority: '0.7',
    title: 'Text Simplifier: Rewrite Text in Plain English, Free',
    description: 'Turn dense or formal writing into plain English with shorter words and sentences. Free, no sign-up, and the facts stay the same.',
    eyebrow: 'TEXT SIMPLIFIER',
    h1: 'Say the same thing<br><em>in plainer words.</em>',
    lead: 'Paste a paragraph of formal, technical or bureaucratic writing and get a version a general reader can follow, with the changes marked.',
    sections: `
<section class="section">
  ${block('When plain language helps', [
    'Notices, instructions, policy documents and abstracts are often written for the writer’s colleagues, not for the people who have to act on them. Plain language means common words, one idea per sentence and the active voice. It is not “dumbing down”: the content stays, and more readers reach the end of it.',
    'The simplifier swaps long words for short ones (“utilize” becomes “use”, “in the event that” becomes “if”, “sufficient” becomes “enough”) and splits sentences joined by semicolons. With a language model connected it also restructures long sentences and turns passive constructions into active ones.'
  ])}
  ${block('Check the result against your purpose', [
    'Simplifying trades precision for reach. Legal, medical and technical terms sometimes have no simpler equivalent, and a tool cannot know which ones matter in your field. Read the “Changes” view and restore any term that has to stay exact.'
  ])}
</section>`,
    faqs: [
      ['Will it shorten my text?', 'Usually a little. The aim is easier sentences, not a summary. Use the summarizer if you need the text much shorter.'],
      ['Does it keep technical terms?', 'The offline rules only replace everyday formal words, so specialist terms are untouched. A language model may reword some; check the changes view.'],
      ['Who is it useful for?', 'Teachers preparing reading material, writers of public notices and help pages, students turning notes into explanations, and anyone writing for readers who use English as an additional language.'],
      ['Is there a word limit?', '3 to 1,500 words, up to 12,000 characters, per request.']
    ]
  },

  /* ------------------------------------------------------------ summarizer */
  {
    path: 'summarizer', kind: 'tool', action: 'summarize', priority: '0.8',
    title: 'Free Text Summarizer: Shorten Articles and Essays',
    description: 'Paste an article, essay or report and get its main points in a fraction of the length. Free, no sign-up, with figures kept accurate.',
    eyebrow: 'SUMMARIZER',
    h1: 'The main points,<br><em>in a quarter of the length.</em>',
    lead: 'Paste up to 1,500 words and get a short version that covers the key points in the order they appear.',
    sections: `
<section class="section">
  ${block('Two ways it can summarize', [
    'With a language model connected, the summarizer writes a new, shorter passage of about a quarter of the original length. The result is rejected if it contains a number that was not in your text, which guards against invented figures.',
    'Without a model, it produces an extractive summary: it scores each sentence by how many of the passage’s frequent content words it contains, gives a small bonus to the opening sentence and to sentences with figures, and keeps the top 30 percent word for word. Nothing is reworded, so nothing can be misstated, but the sentences may not flow as smoothly.'
  ])}
  ${block('Getting a summary you can rely on', [
    'A summary is only as good as its source. Remove menus, captions and reference lists before you paste. For anything you will quote or act on, read the summary against the original once; a tool can miss the one sentence that mattered most to you.'
  ])}
</section>`,
    faqs: [
      ['How long is the summary?', 'About a quarter of the original with a model, or roughly 30 percent of the sentences with offline rules. Passages of one or two sentences are returned unchanged.'],
      ['Can it summarize a PDF?', 'Yes, if the PDF contains real text. Use Upload to open it; the text is extracted on your device. Scanned PDFs are images and cannot be read.'],
      ['Does it work in Hindi?', 'The offline summary works in any language because it selects existing sentences. Quality is best in English, where common filler words are ignored when scoring sentences.'],
      ['Will it make up facts?', 'Offline summaries cannot, because they only select sentences you wrote. Model summaries are checked for new numbers but can still misstate a point, so read them against the source.']
    ]
  },

  /* ---------------------------------------------------------- word counter */
  {
    path: 'word-counter', kind: 'tool', action: 'count', priority: '0.8',
    title: 'Word Counter: Words, Characters and Reading Time',
    description: 'Count words, characters, sentences and paragraphs as you type, with reading and speaking time. Works in Hindi and other languages. Free and private.',
    eyebrow: 'WORD COUNTER',
    h1: 'Count words and characters<br><em>as you type.</em>',
    lead: 'Live counts for essays, abstracts, captions and speeches. Works correctly in Hindi and other scripts, and nothing you type leaves your browser.',
    sections: `
<section class="section">
  ${block('What is counted', [
    'The counter shows words, characters with and without spaces, sentences, paragraphs, unique words, the average and longest sentence, and estimated reading and speaking time. Reading time assumes 200 words a minute and speaking time 130, which are typical for adult readers and for a measured presentation pace.',
    'Many counters split text on spaces and punctuation, which miscounts scripts such as Devanagari, where vowel signs are separate characters, and languages written without spaces, such as Chinese and Japanese. This one uses the language rules built into your browser, so a Hindi sentence of twelve words is counted as twelve.'
  ])}
  ${block('Common limits worth knowing', [
    'Journal abstracts are often capped at 150 to 250 words, and college application essays commonly at around 650. Search engines usually show about 150 to 160 characters of a page description. Always check the exact rule you are writing to, including whether headings, references and spaces are counted.'
  ])}
</section>`,
    faqs: [
      ['Does it count spaces as characters?', 'Both figures are shown: total characters, and characters without spaces.'],
      ['How are sentences counted?', 'Sentences end at a full stop, question mark, exclamation mark or danda. Abbreviations such as “Dr.” and “e.g.” and decimal numbers do not end a sentence.'],
      ['Can I count words in a file?', 'Yes. Use Upload to open a .txt, .md, .docx or text-based .pdf file. It is read on your device.'],
      ['Is there a limit?', 'Up to 30,000 characters at a time.']
    ]
  },

  /* ----------------------------------------------------------------- hindi */
  {
    path: 'hi', kind: 'tool', action: 'detect', lang: 'hi', priority: '0.8',
    title: 'मुफ़्त AI डिटेक्टर: हिंदी और अंग्रेज़ी टेक्स्ट की जाँच',
    description: 'बिना साइन-अप के जाँचें कि टेक्स्ट AI जैसा लगता है या नहीं। स्कोर, कारण और वाक्य-दर-वाक्य हाइलाइट देखें। आपका टेक्स्ट आपके ब्राउज़र में ही रहता है।',
    eyebrow: 'मुफ़्त · बिना साइन-अप · कुछ अपलोड नहीं',
    h1: 'मुफ़्त AI डिटेक्टर<br><em>जो कारण भी बताता है।</em>',
    lead: '30,000 अक्षरों तक का टेक्स्ट पेस्ट करें और AI-समानता स्कोर, उसके पीछे के संकेत और चिह्नित वाक्य देखें। फिर उसी टेक्स्ट को ह्यूमनाइज़ करें, सुधारें, सरल बनाएँ या उसका सारांश निकालें।',
    sections: `
<section id="how-it-works" class="section">
  <p class="eyebrow">तीन कदम</p>
  <h2>टेक्स्ट से साफ़ तस्वीर तक।</h2>
  ${steps([
    ['अपना टेक्स्ट लाएँ', 'पेस्ट करें, टाइप करें या .txt, .md, .docx या .pdf फ़ाइल खोलें। फ़ाइल आपके डिवाइस पर ही पढ़ी जाती है, अपलोड नहीं होती।'],
    ['स्कोर देखें', '0 से 100 का AI-समानता स्कोर, समझाए गए संकेत और वे वाक्य जिनसे स्कोर बना।'],
    ['टेक्स्ट सुधारें', 'ह्यूमनाइज़ करें, व्याकरण सुधारें, सरल करें या सारांश बनाएँ। हर बदलाव आपके मूल टेक्स्ट के सामने दिखता है।']
  ])}
</section>
<section class="section">
  ${block('हिंदी टेक्स्ट के लिए क्या काम करता है', [
    'शब्द, वाक्य और अनुच्छेद की गिनती हिंदी में सही होती है। कई टूल मात्राओं को अलग अक्षर मानकर शब्द तोड़ देते हैं; यह टूल ब्राउज़र के भाषा-नियमों से गिनती करता है, इसलिए बारह शब्दों का वाक्य बारह ही गिना जाता है। पूर्ण विराम (।) पर वाक्य सही जगह टूटते हैं।',
    'AI-समानता स्कोर के शब्दों वाले संकेत अंग्रेज़ी के लिए बने हैं। हिंदी टेक्स्ट के लिए केवल बनावट वाले संकेत इस्तेमाल होते हैं, जैसे वाक्यों की लंबाई में उतार-चढ़ाव, विराम चिह्नों की विविधता और अनुच्छेदों का आकार। इसलिए हिंदी के लिए स्कोर पर भरोसा “कम” दिखाया जाता है और उसे केवल मोटा संकेत समझना चाहिए।',
    'ह्यूमनाइज़, सरल भाषा और सारांश के लिए भाषा मॉडल हिंदी में काम कर सकता है। मॉडल उपलब्ध न हो तो ऑफ़लाइन नियम केवल स्पेस और विराम चिह्न ठीक करते हैं, और सारांश आपके ही वाक्यों में से मुख्य वाक्य चुनता है।'
  ])}
  ${block('यह स्कोर फ़ैसला नहीं है', [
    'कोई भी टूल यह साबित नहीं कर सकता कि टेक्स्ट किसने लिखा। औपचारिक या अकादमिक लेखन का स्कोर ऊँचा आ सकता है, और संपादित AI टेक्स्ट का स्कोर कम। किसी छात्र, कर्मचारी या लेखक के बारे में फ़ैसला केवल इस स्कोर के आधार पर न करें।'
  ])}
</section>`,
    faqs: [
      ['क्या यह पक्का बता सकता है कि टेक्स्ट AI ने लिखा है?', 'नहीं। स्कोर केवल यह बताता है कि लेखन AI के आम पैटर्न से कितना मिलता है। यह दोनों तरफ़ ग़लत हो सकता है।'],
      ['क्या मेरा टेक्स्ट अपलोड होता है?', 'जाँच, गिनती, फ़ाइल पढ़ना और ऑफ़लाइन सुधार आपके ब्राउज़र में ही होते हैं। केवल भाषा मॉडल से दोबारा लिखवाने पर टेक्स्ट सर्वर को जाता है, और टूल यह पहले बता देता है।'],
      ['हिंदी के लिए स्कोर पर भरोसा “कम” क्यों है?', 'क्योंकि शब्दों वाले संकेत अंग्रेज़ी के लिए बने हैं। हिंदी में केवल बनावट वाले संकेत गिने जाते हैं, जिनसे कम जानकारी मिलती है।'],
      ['कितना टेक्स्ट जाँच सकते हैं?', 'जाँच और गिनती के लिए 30,000 अक्षर तक। दोबारा लिखवाने के लिए 3 से 1,500 शब्द।'],
      ['क्या यह सच में मुफ़्त है?', 'हाँ। जाँच और ऑफ़लाइन टूल पूरी तरह मुफ़्त हैं। भाषा मॉडल वाला पुनर्लेखन एक साझा मुफ़्त सीमा से चलता है; दिन की सीमा पूरी होने पर ऑफ़लाइन नियम काम करते हैं।']
    ]
  },

  /* -------------------------------------------------------------- articles */
  {
    path: 'articles', kind: 'index', priority: '0.6',
    title: 'Articles on AI Detection and Clear Writing',
    description: 'Plain-language guides to how AI detectors work, why they misjudge human writing, and how to edit AI-assisted drafts honestly.',
    h1: 'Articles',
    lead: 'Short, practical guides to AI detection and clear writing.'
  },
  {
    path: 'articles/why-ai-detectors-flag-human-writing', kind: 'article', priority: '0.7', date: '2026-11-17',
    title: 'Why AI Detectors Flag Human Writing as AI',
    description: 'Formal, careful and non-native English writing often gets flagged as AI. Here is why it happens and what to do if it happens to you.',
    h1: 'Why AI detectors flag human writing as AI',
    lead: 'A high AI score on something you wrote yourself is unsettling. It is also common, and the reasons are well understood.',
    body: `
<h2>Detectors measure style, not authorship</h2>
<p>No detector can see who typed a text. Each one measures features of the writing and compares them with what it has learned about human and machine text. Two features do most of the work. The first is predictability: how unsurprising each word is given the words before it. The second is variation, often called burstiness: how much sentence length and structure change through the passage. Machine text tends to be predictable and even. So does a lot of careful human writing.</p>
<h2>The kinds of human writing that get flagged</h2>
<ul>
  <li><strong>Formal and academic prose.</strong> Abstracts, literature reviews and reports follow conventions: measured sentences, no contractions, standard connecting phrases. Those conventions are exactly what language models learned to imitate.</li>
  <li><strong>Writing in a second language.</strong> Writers using English as an additional language often rely on a smaller, safer vocabulary and on phrases learned as fixed units. Research on detectors has repeatedly found that such writing is misclassified more often than writing by native speakers.</li>
  <li><strong>Heavily edited text.</strong> Grammar tools and several rounds of polishing remove the small irregularities that mark a text as human.</li>
  <li><strong>Short passages.</strong> A few sentences give a detector very little to measure, so the result is close to a guess.</li>
  <li><strong>Formulaic genres.</strong> Cover letters, product descriptions and instructions sound alike whoever writes them.</li>
</ul>
<h2>What to do if your own work is flagged</h2>
<p>First, look at why. A detector that explains itself, such as <a href="/">the one on this site</a>, lists the signals that raised the score and the sentences involved. Often the cause is a run of same-length sentences or a cluster of stock phrases, and you can decide whether those are worth changing for the reader’s sake.</p>
<p>Second, keep evidence of your process. Drafts, notes, version history in your word processor, and the sources you read are far stronger evidence of authorship than any score. If you are asked about a piece of work, offer those and offer to discuss the content.</p>
<p>Third, do not rewrite good prose just to move a number. Detectors disagree with one another, and a text adjusted to satisfy one can still be flagged by the next.</p>
<h2>If you are the one checking</h2>
<p>Treat a score as a reason to look closer, never as a finding. A false accusation does real harm, and every detector produces false positives. Ask about the writing process, compare with the person’s earlier work, and follow your institution’s procedure. Most detector makers, including this one, say plainly that a score must not be the sole basis for a decision about a person.</p>`
  },
  {
    path: 'articles/how-ai-detectors-work', kind: 'article', priority: '0.7', date: '2026-11-17',
    title: 'How AI Detectors Work: A Plain-Language Guide',
    description: 'What AI detectors actually measure, the difference between statistical and rule-based detection, and how to read a score sensibly.',
    h1: 'How AI detectors work',
    lead: 'AI detectors can look like magic or like guesswork. They are neither. Here is what happens between pasting a text and seeing a percentage.',
    body: `
<h2>The basic idea</h2>
<p>A language model writes by choosing, again and again, a likely next word. That leaves a statistical fingerprint: the text is smoother and more predictable than most people’s writing. Detectors look for that fingerprint. They do not compare your text with a database of AI output, and they cannot trace it back to a particular chatbot session.</p>
<h2>Three families of detector</h2>
<ul>
  <li><strong>Statistical detectors</strong> run the text through a language model and measure how predictable it is, a quantity called perplexity, and how much that predictability varies from sentence to sentence. Low, even perplexity suggests machine text.</li>
  <li><strong>Trained classifiers</strong> are models taught on large sets of labelled human and AI passages. They learn their own features. They can be accurate on text like their training data and unreliable on anything different, such as a new model’s output, another language, or an unusual genre.</li>
  <li><strong>Rule-based detectors</strong> measure visible style features directly: stock phrases, even sentence lengths, formulaic openers, tidy lists of three, the absence of a personal voice. They are transparent and need no model, but they are the easiest to fool and the most likely to misjudge formal writing. The detector on this site is of this kind, and says so.</li>
</ul>
<h2>Why no detector is certain</h2>
<p>Human and machine writing overlap. Some people write smoothly and evenly; a model can be prompted to write unevenly. Light editing of AI text, or translating it, changes the statistics a detector depends on. Every detector therefore makes two kinds of error: it flags some human writing as AI, and it passes some AI writing as human. Reducing one kind of error increases the other.</p>
<h2>How to read a score</h2>
<p>A score of 80 does not mean “80 percent of this was written by AI”, and it does not mean “there is an 80 percent chance this is AI”. It means the text sits toward the machine-like end of whatever that detector measures. Three questions make a score more useful:</p>
<ul>
  <li><strong>How much text was there?</strong> Under about a hundred words, treat any result as weak.</li>
  <li><strong>What kind of text is it?</strong> Formal, technical and second-language writing score higher on most detectors.</li>
  <li><strong>What does the detector say about itself?</strong> Prefer tools that state a confidence level, show which sentences drove the result, and publish how they were tested.</li>
</ul>
<p>You can try this on your own text with <a href="/">the free detector here</a>, which lists each signal and lets you tap any flagged sentence to see the reason.</p>`
  },
  {
    path: 'articles/edit-ai-drafts-to-sound-like-you', kind: 'article', priority: '0.7', date: '2026-11-17',
    title: 'How to Edit an AI Draft So It Sounds Like You',
    description: 'Seven practical edits that turn a generic AI draft into writing with your own voice, plus a note on when to disclose AI help.',
    h1: 'How to edit an AI draft so it sounds like you',
    lead: 'An AI draft is a starting point. What makes it yours is the editing, and the edits that matter most are about content, not word choice.',
    body: `
<h2>1. Cut the opening and the closing</h2>
<p>Model drafts usually begin by restating the topic and end by summarising what was just said. Delete both and see whether anything is lost. Usually the piece starts better at the second paragraph.</p>
<h2>2. Add what only you know</h2>
<p>A model writes what is generally true. You know what happened in your lab, your classroom, your business. Put in the actual figure, the name of the place, the thing that went wrong. Specific detail is the clearest difference between generic text and real writing, and it is the part readers remember.</p>
<h2>3. Take a position</h2>
<p>Drafts tend to balance every point with a counterpoint and conclude that “both have merits”. If you have a view, state it and give your reason. If you do not, say what you would need to know to decide.</p>
<h2>4. Break the rhythm</h2>
<p>Read the draft aloud. If every sentence is the same length, shorten some and join others. A three-word sentence after a long one is fine. So is a question.</p>
<h2>5. Remove stock phrases</h2>
<p>“It is important to note that”, “plays a crucial role”, “in today’s fast-paced world”, “a wide range of”: delete them and the sentence nearly always survives. The <a href="/ai-humanizer">humanizer on this site</a> does this pass for you and shows each change, which is a quick way to see how many of these a draft contains.</p>
<h2>6. Undo the lists of three</h2>
<p>Models like triplets: “efficient, scalable and robust”. Keep the one item you can support and drop the other two.</p>
<h2>7. Check every fact</h2>
<p>Models state wrong things in a confident tone, and invent references. Verify each figure, date, quotation and citation against a source you have opened yourself.</p>
<h2>A note on honesty</h2>
<p>Editing a draft well does not change where it came from. Many universities, journals and employers now have rules on AI assistance, and most ask you to disclose it. Follow the rule that applies to you. Disclosed, carefully edited AI help is accepted in more and more settings; undisclosed use that breaks a rule is a risk no amount of rewording removes.</p>`
  },

  /* ----------------------------------------------------------------- legal */
  {
    path: 'privacy', kind: 'legal', priority: '0.3',
    title: 'Privacy', description: 'What Free AI Detector does with the text you enter: what stays in your browser, what is sent to a language model, and what is stored.', h1: 'Privacy',
    body: `
<p class="updated">Last updated: November 2026. This page describes how the software behaves. The site operator should review it before a public launch.</p>
<h2>What stays on your device</h2>
<p>AI-likeness scoring, word counts, file reading (.txt, .md, .docx, .pdf) and offline rewriting all run in your browser. The text you enter for these features is not sent to any server.</p>
<h2>What is sent when a language model is used</h2>
<p>The Humanize, Fix grammar, Simplify and Summarize tools send the passage you submit to this site’s server, which forwards it to the model provider (Cloudflare Workers AI or OpenAI) and returns the revision. The tool states which mode is active before you run it. The provider’s own retention and abuse-monitoring policies apply to text it receives.</p>
<h2>What is stored</h2>
<p>The server does not save your text and does not log its content. Your current draft is kept in your browser’s session storage so that a reload or a move to another tool page does not lose it; it stays on your device and is erased when you close the tab. The site uses no cookies and no advertising scripts. If the operator has enabled Cloudflare Web Analytics, page views are counted without cookies and without identifying you. The hosting provider keeps ordinary request metadata such as IP address and time, which is also used to limit abusive request rates.</p>
<h2>Your choices</h2>
<p>Do not submit confidential or sensitive material to a model-backed rewrite. Reports, copies and downloads are created only when you choose them.</p>
<h2>Contact</h2>
<p>Questions and requests can be raised through the <a href="__REPO__/issues" target="_blank" rel="noopener noreferrer">project’s issue tracker</a>. Do not include private text in a public issue.</p>`
  },
  {
    path: 'terms', kind: 'legal', priority: '0.3',
    title: 'Terms of use', description: 'Terms for using Free AI Detector: what the score means, how to treat rewrites, and your responsibilities when using the results.', h1: 'Terms of use',
    body: `
<p class="updated">Last updated: November 2026. The site operator should review these terms before a public launch.</p>
<h2>What the score means</h2>
<p>The AI-likeness score is a rule-based estimate drawn from writing-style signals. It cannot establish who or what wrote a text, and it is sometimes wrong in both directions. Do not use it as the sole basis for any academic, employment, disciplinary or legal decision about a person.</p>
<h2>Rewriting tools</h2>
<p>Rewrites are suggestions. Offline rules and language models can change meaning, tone or facts, so compare every result with your original before using it. There is no promise that a rewritten text will be rated as human-written by this or any other detector.</p>
<h2>Your responsibilities</h2>
<p>You are responsible for the text you submit and for how you use the results, including following the rules of your institution, publisher or employer on disclosure of AI assistance. Do not submit material you have no right to share.</p>
<h2>Availability</h2>
<p>The tool is provided as is, without warranty, and may change or be withdrawn. Model-backed rewriting depends on a third-party service and may be rate-limited or unavailable.</p>`
  },
  {
    path: '404', kind: 'legal', noindex: true,
    title: 'Page not found', description: 'This page does not exist.', h1: 'Page not found',
    body: `<p>There is nothing at this address. It may have been moved, or the link may be mistyped.</p><p><a class="button strong" href="/">Go to the AI detector</a></p>`,
    showTools: true
  }
];
