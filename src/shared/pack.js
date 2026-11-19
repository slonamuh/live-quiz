/* Shared by the player and the self-study page: checks a quiz pack (format version 1).
   Needs letters(n) from the page. */
var IMG_RE = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+\/=]+$/;
/* Optional teacher-only fields: the quiz's description, and per case a First Aid topic path
   (chapter › subtopic › entry, up to 3 levels) and the concept it tests. They are shown only on the
   quiz-choosing page (and in the results); never sent to phones. A topic may be a list or "A › B › C". */
function topicOf(q){
  var t = q && q.topic;
  if (typeof t === 'string') t = t.split(/\s*[›>]\s*/);
  if (!Array.isArray(t)) return [];
  return t.map(function(x){ return typeof x === 'string' ? x.trim() : ''; }).filter(Boolean).slice(0, 3);
}
function conceptOf(q){ return q && typeof q.concept === 'string' ? q.concept.trim() : ''; }
function checkPack(p){
  var errs = [], warns = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { errs: ['This file is not a quiz file.'], warns: [] };
  if (!Array.isArray(p.questions) || !p.questions.length) return { errs: ['The file has no cases.'], warns: [] };
  if (p.description != null && typeof p.description !== 'string') errs.push('The quiz description must be text.');
  var images = (p.images && typeof p.images === 'object') ? p.images : {};
  Object.keys(images).forEach(function(k){ if (typeof images[k] !== 'string' || !IMG_RE.test(images[k])) errs.push('Image “' + k + '” is not a valid embedded picture.'); });
  p.questions.forEach(function(q, i){
    var n = 'Case ' + (i+1) + ': ';
    if (!q || typeof q !== 'object') { errs.push(n + 'is empty.'); return; }
    if (typeof q.stem !== 'string' || !q.stem.trim()) errs.push(n + 'the case text is missing.');
    if (typeof q.lead !== 'string' || !q.lead.trim()) errs.push(n + 'the question line is missing.');
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 || q.options.some(function(o){ return typeof o !== 'string' || !o.trim(); })) { errs.push(n + 'needs 2 to 8 answer options, none empty.'); return; }
    var ls = letters(q.options.length);
    if (ls.indexOf(q.answer) < 0) errs.push(n + 'the correct answer must be one of ' + ls.join(', ') + '.');
    ['image', 'explainImage'].forEach(function(k){ if (q[k] && !images[q[k]]) errs.push(n + 'picture “' + q[k] + '” is missing from the pack.'); });
    if (q.topic != null && typeof q.topic !== 'string' && !(Array.isArray(q.topic) && q.topic.length <= 3 && q.topic.every(function(t){ return typeof t === 'string'; }))) errs.push(n + 'the topic must be up to 3 names: chapter, subtopic, entry.');
    if (q.concept != null && typeof q.concept !== 'string') errs.push(n + 'the concept must be text.');
    if (!q.explain) warns.push('Case ' + (i+1) + ' has no explanation.');
  });
  return { errs: errs, warns: warns };
}
