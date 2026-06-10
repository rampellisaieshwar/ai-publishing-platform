import { JSDOM } from 'jsdom';
import { DocumentEnhancements } from './ai';

export interface StructuredBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'callout' | 'image' | 'other';
  level?: number;
  text?: string;
  html?: string;
  listType?: 'ul' | 'ol';
  items?: string[];
  colsCount?: number;
  textLength?: number;
  src?: string;
  caption?: string;
}

export interface StructuredDocument {
  title: string;
  blocks: StructuredBlock[];
}

export function parseHtmlToJSON(htmlContent: string): StructuredDocument {
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  
  const title = doc.querySelector('.page-title')?.textContent || doc.querySelector('title')?.textContent || 'Untitled Study Guide';
  
  const pageBody = doc.querySelector('.page-body') || doc.querySelector('body') || doc;
  
  const blocks: StructuredBlock[] = [];
  
  function getClassifierTarget(el: Element): Element | null {
    if (!el) return null;
    if (el.tagName === 'TABLE' || el.classList.contains('simple-table')) return el;
    if (el.tagName === 'FIGURE' && el.classList.contains('image')) return el;
    if (el.tagName === 'IMG') return el;
    
    const table = el.querySelector('table, .simple-table');
    if (table) return table;
    
    const img = el.querySelector('figure.image, img');
    if (img) return img;
    
    return el;
  }

  const children = Array.from(pageBody.children);
  for (const child of children) {
    if (child.tagName === 'STYLE' || child.tagName === 'SCRIPT' || child.tagName === 'NAV') {
      continue;
    }
    
    if (/^H[1-6]$/.test(child.tagName)) {
      blocks.push({
        type: 'heading',
        level: parseInt(child.tagName.substring(1)),
        text: child.textContent?.trim() || '',
        html: child.outerHTML
      });
      continue;
    }
    
    if (child.classList.contains('callout') || child.querySelector('.callout')) {
      const calloutEl = child.classList.contains('callout') ? child : child.querySelector('.callout')!;
      blocks.push({
        type: 'callout',
        text: calloutEl.textContent?.trim() || '',
        html: child.outerHTML
      });
      continue;
    }
    
    const tableTarget = getClassifierTarget(child);
    if (tableTarget && (tableTarget.tagName === 'TABLE' || tableTarget.classList.contains('simple-table'))) {
      const firstRow = tableTarget.querySelector('tr');
      const colsCount = firstRow ? firstRow.querySelectorAll('th, td').length : 0;
      const textLength = tableTarget.textContent?.trim().length || 0;
      blocks.push({
        type: 'table',
        html: child.outerHTML,
        colsCount,
        textLength,
        text: tableTarget.textContent?.trim() || ''
      });
      continue;
    }
    
    if (tableTarget && (tableTarget.tagName === 'IMG' || (tableTarget.tagName === 'FIGURE' && tableTarget.classList.contains('image')))) {
      const imgEl = tableTarget.tagName === 'IMG' ? tableTarget : tableTarget.querySelector('img');
      const src = imgEl ? imgEl.getAttribute('src') || '' : '';
      const caption = tableTarget.querySelector('figcaption')?.textContent || '';
      blocks.push({
        type: 'image',
        src,
        caption,
        html: child.outerHTML
      });
      continue;
    }
    
    if (child.tagName === 'UL' || child.tagName === 'OL') {
      const items = Array.from(child.querySelectorAll('li')).map(li => li.innerHTML);
      blocks.push({
        type: 'list',
        listType: child.tagName.toLowerCase() as 'ul' | 'ol',
        items,
        html: child.outerHTML,
        text: child.textContent?.trim() || ''
      });
      continue;
    }
    
    if (child.tagName === 'P') {
      blocks.push({
        type: 'paragraph',
        text: child.textContent?.trim() || '',
        html: child.outerHTML
      });
      continue;
    }
    
    blocks.push({
      type: 'other',
      text: child.textContent?.trim() || '',
      html: child.outerHTML
    });
  }
  
  return { title, blocks };
}

export function mergeEnhancementsToHtml(htmlContent: string, enhancements: DocumentEnhancements): string {
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  const pageBody = doc.querySelector('.page-body') || doc.querySelector('body') || doc;

  // 1. Objectives & Overview
  if (enhancements.learningObjectives && enhancements.learningObjectives.length > 0) {
    const objDiv = doc.createElement('div');
    objDiv.className = 'callout';
    objDiv.setAttribute('style', 'border-left: 4px solid var(--primary-green) !important; margin-bottom: 15px;');
    
    let objHtml = `<div class="callout-title">🚀 LEARNING OBJECTIVES & OVERVIEW</div><ul style="margin-bottom: 8px;">`;
    for (const obj of enhancements.learningObjectives) {
      objHtml += `<li>${obj}</li>`;
    }
    objHtml += `</ul>`;
    
    if (enhancements.summary) {
      objHtml += `<p style="margin-top: 10px; font-weight: 500; font-style: italic; margin-bottom: 0;">${enhancements.summary}</p>`;
    }
    
    objDiv.innerHTML = objHtml;
    
    // Insert at the beginning of pageBody
    if (pageBody.firstChild) {
      pageBody.insertBefore(objDiv, pageBody.firstChild);
    } else {
      pageBody.appendChild(objDiv);
    }
  }

  // 2. High-Yield Exam Concepts
  if (enhancements.examConcepts && enhancements.examConcepts.length > 0) {
    const h2 = doc.createElement('h2');
    h2.setAttribute('style', 'color: var(--primary-blue); border-bottom: 1.5px solid var(--primary-green); padding-bottom: 3px; margin-top: 20px;');
    h2.textContent = '📌 High-Yield Exam Concepts';
    pageBody.appendChild(h2);

    const container = doc.createElement('div');
    container.setAttribute('style', 'display: flex; flex-direction: column; gap: 10px; margin: 10px 0;');
    
    for (const item of enhancements.examConcepts) {
      const card = doc.createElement('div');
      card.className = 'callout';
      card.setAttribute('style', 'margin: 5px 0;');
      card.innerHTML = `<div class="callout-title" style="color: var(--primary-blue); font-weight:700;">${item.concept}</div><p>${item.definition}</p>`;
      container.appendChild(card);
    }
    pageBody.appendChild(container);
  }

  // 3. Common Student Pitfalls & Mistakes
  if (enhancements.commonMistakes && enhancements.commonMistakes.length > 0) {
    const h2 = doc.createElement('h2');
    h2.setAttribute('style', 'color: #DC2626; border-bottom: 1.5px solid #DC2626; padding-bottom: 3px; margin-top: 20px;');
    h2.textContent = '⚠️ Common Student Pitfalls & Mistakes';
    pageBody.appendChild(h2);

    const container = doc.createElement('div');
    container.setAttribute('style', 'display: flex; flex-direction: column; gap: 10px; margin: 10px 0;');
    
    for (const item of enhancements.commonMistakes) {
      const card = doc.createElement('div');
      card.className = 'callout';
      card.setAttribute('style', 'background-color: rgba(220, 38, 38, 0.05) !important; border-color: #DC2626 !important; margin: 5px 0;');
      card.innerHTML = `
        <div class="callout-title" style="color: #DC2626; font-weight:700;">❌ Misconception:</div>
        <p style="font-weight: 600; margin-bottom: 6px;">${item.mistake}</p>
        <div style="color: var(--primary-green); font-weight: 700; margin-top: 4px;">✅ Correction:</div>
        <p style="font-style: italic; margin-bottom: 0;">${item.correction}</p>
      `;
      container.appendChild(card);
    }
    pageBody.appendChild(container);
  }

  // 4. Practice MCQs & Interview Q&A
  const hasMcqs = enhancements.mcqs && enhancements.mcqs.length > 0;
  const hasInterview = enhancements.interviewQuestions && enhancements.interviewQuestions.length > 0;
  if (hasMcqs || hasInterview) {
    const h2 = doc.createElement('h2');
    h2.setAttribute('style', 'color: var(--primary-blue); border-bottom: 1.5px solid var(--primary-green); padding-bottom: 3px; margin-top: 20px;');
    h2.textContent = '📝 Practice Assessment';
    pageBody.appendChild(h2);

    if (hasMcqs) {
      const subh3 = doc.createElement('h3');
      subh3.setAttribute('style', 'color: var(--primary-green); margin-top: 12px;');
      subh3.textContent = 'Multiple Choice Questions';
      pageBody.appendChild(subh3);

      const ol = doc.createElement('ol');
      ol.setAttribute('style', 'padding-left: 18px; margin-top: 8px; list-style-type: decimal;');
      
      for (const q of enhancements.mcqs!) {
        const li = doc.createElement('li');
        li.setAttribute('style', 'margin-bottom: 14px;');
        
        let qHtml = `<strong style="display:block; margin-bottom:6px;">${q.question}</strong>`;
        qHtml += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:6px 0;">`;
        for (const opt of q.options) {
          qHtml += `<div>${opt}</div>`;
        }
        qHtml += `</div>`;
        qHtml += `
          <div class="callout" style="margin-top: 6px; padding: 6px 10px; font-size: 8.5px; background-color: #F8FAFC !important; border: 1px solid var(--border-color) !important;">
            <strong>Correct Answer: Option ${q.correctOption}</strong><br/>
            <span style="color: var(--light-text);">${q.explanation}</span>
          </div>
        `;
        li.innerHTML = qHtml;
        ol.appendChild(li);
      }
      pageBody.appendChild(ol);
    }

    if (hasInterview) {
      const subh3 = doc.createElement('h3');
      subh3.setAttribute('style', 'color: var(--primary-green); margin-top: 14px;');
      subh3.textContent = 'Conceptual Interview Q&A';
      pageBody.appendChild(subh3);

      const qnaContainer = doc.createElement('div');
      qnaContainer.setAttribute('style', 'display: flex; flex-direction: column; gap: 10px; margin-top: 8px;');

      enhancements.interviewQuestions!.forEach((q, idx) => {
        const item = doc.createElement('div');
        item.setAttribute('style', 'margin-bottom: 8px;');
        item.innerHTML = `
          <strong>Q${idx + 1}: ${q.question}</strong>
          <p style="margin-top: 4px; font-style: italic; color: #475569; margin-bottom: 0;">Answer: ${q.answer}</p>
        `;
        qnaContainer.appendChild(item);
      });
      pageBody.appendChild(qnaContainer);
    }
  }

  return dom.serialize();
}
