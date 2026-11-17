/**
 * Interface strings for the tool, in English and Hindi.
 * The page language comes from <html lang>. Score details produced by detector.js (the numeric
 * line under each signal) and downloaded reports stay in English.
 */
const en = {
  run: { detect: 'Check text', humanize: 'Humanize', grammar: 'Fix grammar', simplify: 'Simplify', summarize: 'Summarize', count: 'Count words' },
  label: { detect: 'Score', humanize: 'Humanize', grammar: 'Fix grammar', simplify: 'Simplify', summarize: 'Summarize', count: 'Word count' },
  verb: { humanize: 'Humanizing', grammar: 'Checking', simplify: 'Simplifying', summarize: 'Summarizing' },
  empty: {
    detect: ['Paste text to see its score.', 'You will get a 0–100 AI-likeness score, the signals behind it and sentence highlights.'],
    humanize: ['A more natural version will appear here.', 'Your original stays in the editor so you can compare.'],
    grammar: ['A corrected version will appear here.', 'Every correction is highlighted against your original.'],
    simplify: ['A plainer version will appear here.', 'Shorter words and sentences, same facts.'],
    summarize: ['A summary will appear here.', 'The key points, in the order they appear.'],
    count: ['Start typing to see the counts.', 'Words, characters, sentences, paragraphs and reading time update as you type.']
  },
  ready: 'Ready', scoring: 'Scoring', scoreReady: 'Score ready', revisionReady: 'Revision ready', noChanges: 'No changes needed', wentWrong: 'Something went wrong', live: 'Live',
  words: n => `${n} ${n === '1' ? 'word' : 'words'}`, characters: n => `${n} characters`,
  guideScore: max => `Any length up to ${max} characters.`,
  guideRewrite: (min, max, chars) => `${min}–${max} words, up to ${chars} characters.`,
  guideCount: 'Counts update as you type. Nothing is uploaded.',
  noteScore: 'Scoring runs on this device.', noteCount: 'Counting runs on this device.',
  noteModel: name => `Rewriting with ${name}.`, noteOffline: 'Offline rewriting (rule-based).',
  discScore: 'The score is a rule-based estimate of how closely the writing matches patterns common in AI output. It is not proof of authorship. Your text is not uploaded.',
  discCount: 'Counts are exact for the text in the editor and work in any language. Reading time assumes 200 words a minute, speaking time 130.',
  discModel: name => `This tool sends your text through this site’s server to ${name} and shows the revision beside your original. Do not submit sensitive material. Review every revision before using it.`,
  discOffline: 'No language model is connected, so this tool uses offline rules in your browser. Edits are conservative and your text is not uploaded. A connected model gives deeper rewrites.',
  errEmpty: 'Add some text first, or load an example.', errNoWords: 'This text has no words to score.',
  errTooLong: (max, n) => `This tool accepts up to ${max} characters. This text has ${n}.`,
  errMinWords: n => `Add at least ${n} words to rewrite.`,
  errMaxWords: (max, n) => `Rewriting accepts up to ${max} words. This text has ${n}.`,
  errClipboardEmpty: 'Your clipboard is empty. Copy some text first.',
  errClipboardBlocked: 'Clipboard access is blocked. Click in the editor and press Ctrl+V or ⌘V.',
  errTrimmed: max => `Only the first ${max} characters were loaded.`,
  errFileType: 'Choose a .txt, .md, .docx or .pdf file.',
  errFileSize: mb => `That file is larger than ${mb} MB. Paste the part you want to check instead.`,
  errFileEmpty: 'No text was found in that file.',
  errDocx: 'This .docx file could not be read. Open it in Word, copy the text and paste it here.',
  errPdf: 'No text could be read from this PDF. Scanned PDFs are images; copy the text from another source and paste it.',
  errText: 'This file is not plain UTF-8 text. Save it as UTF-8 and try again.',
  readingPdf: 'Reading the PDF on this device…',
  loadingScore: ['Reading the patterns…', 'Scoring on this device.'],
  loadingModel: name => `Waiting for ${name}. Your original stays in the editor.`, loadingOffline: 'Applying offline rules on this device.',
  ringLabel: 'AI-LIKENESS', ringAria: n => `AI-likeness score ${n} out of 100`,
  confidence: 'Confidence', languageCheck: 'Language check',
  why: 'Why this score', noSignals: 'There is too little text for any signal to be measured.', scale: '0 = human-like, 100 = AI-like',
  sentenceView: 'Sentence view', legendHigh: 'Strongly AI-like', legendMedium: 'Somewhat AI-like', legendNone: 'No strong signal',
  reasonPrompt: 'Tap or hover a highlighted sentence to see why it was flagged.', reasonPrefix: 'Flagged for: ', reasonNeutral: 'even, neutral phrasing',
  counts: 'Counts', statWords: 'Words', statSentences: 'Sentences', statParagraphs: 'Paragraphs', statAverage: 'Avg. sentence', statUnique: 'Unique words', statFlagged: 'Flagged sentences',
  statChars: 'Characters', statCharsNoSpaces: 'Without spaces', statReading: 'Reading time', statSpeaking: 'Speaking time', statLongest: 'Longest sentence',
  wordsUnit: n => `${n} words`, minutes: (m, s) => m ? `${m} min ${s} s` : `${s} s`,
  download: 'Download report', print: 'Print or save as PDF', copySummary: 'Copy summary', humanizeThis: 'Humanize this text', checkThis: 'Check this version',
  copy: 'Copy', copied: 'Copied', copyFailed: 'Select the text and press Ctrl/⌘+C', downloadTxt: 'Download .txt', result: 'Result', changes: 'Changes', chooseView: 'Choose a view',
  offlineChip: 'Offline rules', modelNote: 'AI-assisted revision produced by a language model.', fallback: 'Showing the offline rewrite instead.',
  compare: 'Compare the result with your original before using it. There is no promise that any detector will rate it as human-written.',
  modelFailed: 'The model service could not be reached.', modelTimeout: 'The model service timed out.',
  summaryLine: (score, band, conf) => `AI-likeness score: ${score}/100 (${band}; confidence ${conf}). Heuristic estimate, not proof of authorship.`,
  detailNote: '',
  band: {}, conf: {}, confNote: {}, signal: {}, hint: {}, language: {}, limitation: null
};

const hi = {
  run: { detect: 'टेक्स्ट जाँचें', humanize: 'ह्यूमनाइज़ करें', grammar: 'व्याकरण सुधारें', simplify: 'सरल करें', summarize: 'सारांश बनाएँ', count: 'शब्द गिनें' },
  label: { detect: 'स्कोर', humanize: 'ह्यूमनाइज़', grammar: 'व्याकरण सुधार', simplify: 'सरल भाषा', summarize: 'सारांश', count: 'शब्द गिनती' },
  verb: { humanize: 'ह्यूमनाइज़ हो रहा है', grammar: 'जाँच हो रही है', simplify: 'सरल किया जा रहा है', summarize: 'सारांश बन रहा है' },
  empty: {
    detect: ['स्कोर देखने के लिए टेक्स्ट पेस्ट करें।', 'आपको 0–100 का AI-समानता स्कोर, उसके कारण और वाक्य-दर-वाक्य हाइलाइट मिलेंगे।'],
    humanize: ['ज़्यादा स्वाभाविक संस्करण यहाँ दिखेगा।', 'आपका मूल टेक्स्ट एडिटर में बना रहेगा ताकि आप तुलना कर सकें।'],
    grammar: ['सुधरा हुआ संस्करण यहाँ दिखेगा।', 'हर सुधार मूल टेक्स्ट के सामने हाइलाइट होगा।'],
    simplify: ['सरल संस्करण यहाँ दिखेगा।', 'छोटे शब्द और वाक्य, तथ्य वही।'],
    summarize: ['सारांश यहाँ दिखेगा।', 'मुख्य बातें, उसी क्रम में।'],
    count: ['गिनती देखने के लिए लिखना शुरू करें।', 'शब्द, अक्षर, वाक्य, अनुच्छेद और पढ़ने का समय लिखते-लिखते बदलते हैं।']
  },
  ready: 'तैयार', scoring: 'जाँच हो रही है', scoreReady: 'स्कोर तैयार', revisionReady: 'नया संस्करण तैयार', noChanges: 'कोई बदलाव ज़रूरी नहीं', wentWrong: 'कुछ गड़बड़ हुई', live: 'लाइव',
  words: n => `${n} शब्द`, characters: n => `${n} अक्षर`,
  guideScore: max => `${max} अक्षरों तक कोई भी लंबाई।`,
  guideRewrite: (min, max, chars) => `${min}–${max} शब्द, अधिकतम ${chars} अक्षर।`,
  guideCount: 'गिनती लिखते-लिखते बदलती है। कुछ भी अपलोड नहीं होता।',
  noteScore: 'जाँच इसी डिवाइस पर होती है।', noteCount: 'गिनती इसी डिवाइस पर होती है।',
  noteModel: name => `${name} से दोबारा लिखा जा रहा है।`, noteOffline: 'ऑफ़लाइन पुनर्लेखन (नियम-आधारित)।',
  discScore: 'यह स्कोर नियमों पर आधारित अनुमान है कि लेखन AI के आम पैटर्न से कितना मिलता है। यह इस बात का प्रमाण नहीं है कि टेक्स्ट किसने लिखा। आपका टेक्स्ट अपलोड नहीं होता।',
  discCount: 'गिनती एडिटर के टेक्स्ट के लिए सटीक है और हर भाषा में काम करती है। पढ़ने का समय 200 शब्द प्रति मिनट और बोलने का समय 130 शब्द प्रति मिनट मानकर निकाला गया है।',
  discModel: name => `यह टूल आपका टेक्स्ट इस साइट के सर्वर से ${name} को भेजता है और नया संस्करण मूल के साथ दिखाता है। संवेदनशील सामग्री न भेजें। इस्तेमाल से पहले हर संस्करण जाँच लें।`,
  discOffline: 'कोई भाषा मॉडल जुड़ा नहीं है, इसलिए यह टूल आपके ब्राउज़र में ऑफ़लाइन नियमों से काम करता है। बदलाव सीमित होते हैं और शब्द-नियम केवल अंग्रेज़ी के लिए हैं। आपका टेक्स्ट अपलोड नहीं होता।',
  errEmpty: 'पहले कुछ टेक्स्ट जोड़ें या कोई उदाहरण चुनें।', errNoWords: 'इस टेक्स्ट में जाँचने लायक कोई शब्द नहीं है।',
  errTooLong: (max, n) => `यह टूल अधिकतम ${max} अक्षर लेता है। इस टेक्स्ट में ${n} अक्षर हैं।`,
  errMinWords: n => `दोबारा लिखने के लिए कम से कम ${n} शब्द जोड़ें।`,
  errMaxWords: (max, n) => `पुनर्लेखन अधिकतम ${max} शब्द लेता है। इस टेक्स्ट में ${n} शब्द हैं।`,
  errClipboardEmpty: 'आपका क्लिपबोर्ड खाली है। पहले कुछ टेक्स्ट कॉपी करें।',
  errClipboardBlocked: 'क्लिपबोर्ड की अनुमति नहीं है। एडिटर में क्लिक करके Ctrl+V दबाएँ।',
  errTrimmed: max => `केवल पहले ${max} अक्षर लोड किए गए।`,
  errFileType: '.txt, .md, .docx या .pdf फ़ाइल चुनें।',
  errFileSize: mb => `यह फ़ाइल ${mb} MB से बड़ी है। जो हिस्सा जाँचना है उसे पेस्ट करें।`,
  errFileEmpty: 'इस फ़ाइल में कोई टेक्स्ट नहीं मिला।',
  errDocx: 'यह .docx फ़ाइल पढ़ी नहीं जा सकी। इसे Word में खोलकर टेक्स्ट कॉपी करें और यहाँ पेस्ट करें।',
  errPdf: 'इस PDF से टेक्स्ट नहीं पढ़ा जा सका। स्कैन की हुई PDF तस्वीर होती है; टेक्स्ट कहीं और से कॉपी करके पेस्ट करें।',
  errText: 'यह फ़ाइल सादा UTF-8 टेक्स्ट नहीं है। इसे UTF-8 में सेव करके दोबारा कोशिश करें।',
  readingPdf: 'PDF इसी डिवाइस पर पढ़ी जा रही है…',
  loadingScore: ['पैटर्न पढ़े जा रहे हैं…', 'जाँच इसी डिवाइस पर हो रही है।'],
  loadingModel: name => `${name} का इंतज़ार है। आपका मूल टेक्स्ट एडिटर में सुरक्षित है।`, loadingOffline: 'इसी डिवाइस पर ऑफ़लाइन नियम लगाए जा रहे हैं।',
  ringLabel: 'AI-समानता', ringAria: n => `AI-समानता स्कोर 100 में से ${n}`,
  confidence: 'भरोसा', languageCheck: 'भाषा जाँच',
  why: 'यह स्कोर क्यों', noSignals: 'किसी संकेत को मापने के लिए टेक्स्ट बहुत कम है।', scale: '0 = इंसान जैसा, 100 = AI जैसा',
  sentenceView: 'वाक्य-दर-वाक्य', legendHigh: 'बहुत AI जैसा', legendMedium: 'कुछ AI जैसा', legendNone: 'कोई मज़बूत संकेत नहीं',
  reasonPrompt: 'कारण देखने के लिए किसी हाइलाइट किए गए वाक्य पर टैप करें।', reasonPrefix: 'कारण: ', reasonNeutral: 'एक-सा, सपाट लेखन',
  counts: 'गिनती', statWords: 'शब्द', statSentences: 'वाक्य', statParagraphs: 'अनुच्छेद', statAverage: 'औसत वाक्य', statUnique: 'अलग-अलग शब्द', statFlagged: 'चिह्नित वाक्य',
  statChars: 'अक्षर', statCharsNoSpaces: 'बिना स्पेस', statReading: 'पढ़ने का समय', statSpeaking: 'बोलने का समय', statLongest: 'सबसे लंबा वाक्य',
  wordsUnit: n => `${n} शब्द`, minutes: (m, s) => m ? `${m} मिनट ${s} सेकंड` : `${s} सेकंड`,
  download: 'रिपोर्ट डाउनलोड करें', print: 'प्रिंट करें या PDF सेव करें', copySummary: 'सार कॉपी करें', humanizeThis: 'इसे ह्यूमनाइज़ करें', checkThis: 'इस संस्करण को जाँचें',
  copy: 'कॉपी करें', copied: 'कॉपी हो गया', copyFailed: 'टेक्स्ट चुनकर Ctrl+C दबाएँ', downloadTxt: '.txt डाउनलोड करें', result: 'नतीजा', changes: 'बदलाव', chooseView: 'दृश्य चुनें',
  offlineChip: 'ऑफ़लाइन नियम', modelNote: 'यह संस्करण भाषा मॉडल की मदद से बना है।', fallback: 'इसकी जगह ऑफ़लाइन संस्करण दिखाया जा रहा है।',
  compare: 'इस्तेमाल से पहले नतीजे की तुलना अपने मूल टेक्स्ट से करें। कोई वादा नहीं है कि कोई डिटेक्टर इसे इंसान का लिखा मानेगा।',
  modelFailed: 'मॉडल सेवा तक पहुँचा नहीं जा सका।', modelTimeout: 'मॉडल सेवा ने समय पर जवाब नहीं दिया।',
  summaryLine: (score, band, conf) => `AI-समानता स्कोर: ${score}/100 (${band}; भरोसा ${conf})। यह अनुमान है, लेखक का प्रमाण नहीं।`,
  detailNote: 'आँकड़ों वाली पंक्तियाँ अंग्रेज़ी में हैं।',
  band: { high: 'ज़्यादातर AI जैसे पैटर्न', medium: 'मिला-जुला या अनिश्चित', low: 'ज़्यादातर इंसान जैसे पैटर्न' },
  conf: { 'Very low': 'बहुत कम', Low: 'कम', Moderate: 'मध्यम', Fair: 'ठीक-ठाक' },
  language: { English: 'अंग्रेज़ी', 'Non-Latin script': 'ग़ैर-लैटिन लिपि', 'English (assumed, short text)': 'अंग्रेज़ी (अनुमान, छोटा टेक्स्ट)', 'Latin script, probably not English': 'लैटिन लिपि, शायद अंग्रेज़ी नहीं', 'No letters found': 'कोई अक्षर नहीं मिला' },
  confNote: {
    tooShort: '40 से कम शब्द। परखने के लिए टेक्स्ट बहुत कम है, इसलिए स्कोर 50 के पास रहता है।',
    degenerate: 'इस टेक्स्ट में अलग-अलग वाक्य बहुत कम हैं या दोहराव बहुत ज़्यादा है, इसलिए संकेतों का कोई मतलब नहीं निकलता।',
    nonEnglish: 'शब्दों वाले संकेत अंग्रेज़ी के लिए बने हैं। इस टेक्स्ट के लिए केवल बनावट वाले संकेत इस्तेमाल हुए।',
    short: '120 से कम शब्द। स्कोर को मोटा अंदाज़ा समझें।',
    medium: 'कुछ सौ शब्द और हों तो अनुमान ज़्यादा स्थिर होगा।',
    fair: 'संकेतों के लिए पर्याप्त टेक्स्ट है। फिर भी यह अनुमान है, प्रमाण नहीं।'
  },
  signal: {
    stock: 'घिसे-पिटे वाक्यांश', burstiness: 'वाक्यों की लय', openers: 'एक जैसे शुरुआती शब्द', voice: 'निजी आवाज़', triads: 'तीन-तीन की सूचियाँ',
    participles: 'अंत में “-ing” वाले उपवाक्य', punctuation: 'विराम चिह्नों की विविधता', shortSentences: 'छोटे वाक्य', specificity: 'ठोस ब्योरा',
    paragraphShape: 'अनुच्छेदों की एकरूपता', assistant: 'चैटबॉट जैसी भाषा'
  },
  hint: {
    stock: 'AI का लिखा अक्सर कुछ जाने-पहचाने, सुरक्षित वाक्यांशों पर टिका होता है।',
    burstiness: 'लगभग बराबर लंबाई के वाक्य AI में आम हैं; लोग ज़्यादा उतार-चढ़ाव रखते हैं।',
    openers: '“Furthermore”, “Another important…” जैसे शुरुआती शब्द।',
    voice: 'निजी आवाज़ की कमी AI में आम है, और औपचारिक मानवीय लेखन में भी।',
    triads: 'AI को “A, B, and C” जैसी साफ़-सुथरी तिकड़ियाँ पसंद हैं।',
    participles: '“…, fostering growth” जैसे अंत वाले वाक्य।',
    punctuation: 'लोग ज़्यादा सवाल पूछते हैं, कोष्ठक लगाते हैं और बात अधूरी छोड़ते हैं।',
    shortSentences: 'AI बहुत छोटे वाक्य कम लिखता है।',
    specificity: 'AI के सामान्य लेखन में आँकड़े, स्रोत और नाम कम होते हैं।',
    paragraphShape: 'बराबर आकार के अनुच्छेद AI में आम हैं।',
    assistant: 'ऐसे वाक्यांश चैटबॉट से सीधे कॉपी किए गए जवाबों में मिलते हैं।'
  },
  limitation: 'यह लेखन-शैली के संकेतों से निकला अनुमान है। यह तय नहीं कर सकता कि टेक्स्ट किसने या किस चीज़ ने लिखा, और किसी शैक्षणिक, नौकरी या अनुशासन संबंधी फ़ैसले का अकेला आधार नहीं होना चाहिए।'
};

const LANGS = { en, hi };

/** Returns the string table for the page language, with English as the fallback for missing keys. */
export function strings(lang = 'en') {
  const table = LANGS[lang] || en;
  return new Proxy(table, { get: (target, key) => (key in target ? target[key] : en[key]) });
}
export const numberLocale = lang => (lang === 'hi' ? 'en-IN' : 'en-US');
