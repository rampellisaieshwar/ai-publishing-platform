import * as cheerio from 'cheerio';
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
  const $ = cheerio.load(htmlContent);
  
  const title = $('.page-title').text() || $('title').text() || 'Untitled Study Guide';
  
  const pageBody = ($('.page-body').length ? $('.page-body') : $('body').length ? $('body') : $.root()) as any;
  
  const blocks: StructuredBlock[] = [];
  
  pageBody.children().each((_: any, childEl: any) => {
    const child = $(childEl);
    const tagName = childEl.tagName ? childEl.tagName.toUpperCase() : '';
    if (!tagName) return;

    if (tagName === 'STYLE' || tagName === 'SCRIPT' || tagName === 'NAV') {
      return;
    }
    
    if (/^H[1-6]$/.test(tagName)) {
      blocks.push({
        type: 'heading',
        level: parseInt(tagName.substring(1)),
        text: child.text().trim() || '',
        html: $.html(child)
      });
      return;
    }
    
    if (child.hasClass('callout') || child.find('.callout').length > 0) {
      const calloutEl = child.hasClass('callout') ? child : child.find('.callout').first();
      blocks.push({
        type: 'callout',
        text: calloutEl.text().trim() || '',
        html: $.html(child)
      });
      return;
    }
    
    // Check for table
    let tableTarget = null;
    if (tagName === 'TABLE' || child.hasClass('simple-table')) {
      tableTarget = child;
    } else {
      const table = child.find('table, .simple-table');
      if (table.length > 0) tableTarget = table.first();
    }

    if (tableTarget) {
      const firstRow = tableTarget.find('tr').first();
      const colsCount = firstRow.find('th, td').length;
      const textLength = tableTarget.text().trim().length;
      blocks.push({
        type: 'table',
        html: $.html(child),
        colsCount,
        textLength,
        text: tableTarget.text().trim() || ''
      });
      return;
    }
    
    // Check for image
    let imgTarget = null;
    if (tagName === 'IMG') {
      imgTarget = child;
    } else if (tagName === 'FIGURE' && child.hasClass('image')) {
      imgTarget = child;
    } else {
      const img = child.find('figure.image, img');
      if (img.length > 0) imgTarget = img.first();
    }

    if (imgTarget) {
      const imgEl = imgTarget.is('img') ? imgTarget : imgTarget.find('img').first();
      const src = imgEl.attr('src') || '';
      const caption = imgTarget.find('figcaption').text() || '';
      blocks.push({
        type: 'image',
        src,
        caption,
        html: $.html(child)
      });
      return;
    }
    
    if (tagName === 'UL' || tagName === 'OL') {
      const items: string[] = [];
      child.find('li').each((_, liEl) => {
        items.push($(liEl).html() || '');
      });
      blocks.push({
        type: 'list',
        listType: tagName.toLowerCase() as 'ul' | 'ol',
        items,
        html: $.html(child),
        text: child.text().trim() || ''
      });
      return;
    }
    
    if (tagName === 'P') {
      blocks.push({
        type: 'paragraph',
        text: child.text().trim() || '',
        html: $.html(child)
      });
      return;
    }
    
    blocks.push({
      type: 'other',
      text: child.text().trim() || '',
      html: $.html(child)
    });
  });
  
  return { title, blocks };
}

export function mergeEnhancementsToHtml(htmlContent: string, enhancements: DocumentEnhancements): string {
  const $ = cheerio.load(htmlContent);
  const pageBody = ($('.page-body').length ? $('.page-body') : $('body').length ? $('body') : $.root()) as any;

  // 1. Objectives & Overview
  if (enhancements.learningObjectives && enhancements.learningObjectives.length > 0) {
    let objHtml = `
      <div class="callout" style="border-left: 4px solid var(--primary-green) !important; margin-bottom: 15px;">
        <div class="callout-title">🚀 LEARNING OBJECTIVES & OVERVIEW</div>
        <ul style="margin-bottom: 8px;">
    `;
    for (const obj of enhancements.learningObjectives) {
      objHtml += `<li>${obj}</li>`;
    }
    objHtml += `</ul>`;
    
    if (enhancements.summary) {
      objHtml += `<p style="margin-top: 10px; font-weight: 500; font-style: italic; margin-bottom: 0;">${enhancements.summary}</p>`;
    }
    objHtml += `</div>`;
    
    pageBody.prepend(objHtml);
  }

  // 2. High-Yield Exam Concepts
  if (enhancements.examConcepts && enhancements.examConcepts.length > 0) {
    let conceptsHtml = `
      <h2 style="color: var(--primary-blue); border-bottom: 1.5px solid var(--primary-green); padding-bottom: 3px; margin-top: 20px;">📌 High-Yield Exam Concepts</h2>
      <div style="display: flex; flex-direction: column; gap: 10px; margin: 10px 0;">
    `;
    for (const item of enhancements.examConcepts) {
      conceptsHtml += `
        <div class="callout" style="margin: 5px 0;">
          <div class="callout-title" style="color: var(--primary-blue); font-weight:700;">${item.concept}</div>
          <p>${item.definition}</p>
        </div>
      `;
    }
    conceptsHtml += `</div>`;
    pageBody.append(conceptsHtml);
  }

  // 3. Common Student Pitfalls & Mistakes
  if (enhancements.commonMistakes && enhancements.commonMistakes.length > 0) {
    let mistakesHtml = `
      <h2 style="color: #DC2626; border-bottom: 1.5px solid #DC2626; padding-bottom: 3px; margin-top: 20px;">⚠️ Common Student Pitfalls & Mistakes</h2>
      <div style="display: flex; flex-direction: column; gap: 10px; margin: 10px 0;">
    `;
    for (const item of enhancements.commonMistakes) {
      mistakesHtml += `
        <div class="callout" style="background-color: rgba(220, 38, 38, 0.05) !important; border-color: #DC2626 !important; margin: 5px 0;">
          <div class="callout-title" style="color: #DC2626; font-weight:700;">❌ Misconception:</div>
          <p style="font-weight: 600; margin-bottom: 6px;">${item.mistake}</p>
          <div style="color: var(--primary-green); font-weight: 700; margin-top: 4px;">✅ Correction:</div>
          <p style="font-style: italic; margin-bottom: 0;">${item.correction}</p>
        </div>
      `;
    }
    mistakesHtml += `</div>`;
    pageBody.append(mistakesHtml);
  }

  // 4. Practice MCQs & Interview Q&A
  const hasMcqs = enhancements.mcqs && enhancements.mcqs.length > 0;
  const hasInterview = enhancements.interviewQuestions && enhancements.interviewQuestions.length > 0;
  if (hasMcqs || hasInterview) {
    let practiceHtml = `
      <h2 style="color: var(--primary-blue); border-bottom: 1.5px solid var(--primary-green); padding-bottom: 3px; margin-top: 20px;">📝 Practice Assessment</h2>
    `;

    if (hasMcqs) {
      practiceHtml += `
        <h3 style="color: var(--primary-green); margin-top: 12px;">Multiple Choice Questions</h3>
        <ol style="padding-left: 18px; margin-top: 8px; list-style-type: decimal;">
      `;
      for (const q of enhancements.mcqs!) {
        practiceHtml += `
          <li style="margin-bottom: 14px;">
            <strong style="display:block; margin-bottom:6px;">${q.question}</strong>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:6px 0;">
        `;
        for (const opt of q.options) {
          practiceHtml += `<div>${opt}</div>`;
        }
        practiceHtml += `</div>`;
        practiceHtml += `
            <div class="callout" style="margin-top: 6px; padding: 6px 10px; font-size: 8.5px; background-color: #F8FAFC !important; border: 1px solid var(--border-color) !important;">
              <strong>Correct Answer: Option ${q.correctOption}</strong><br/>
              <span style="color: var(--light-text);">${q.explanation}</span>
            </div>
          </li>
        `;
      }
      practiceHtml += `</ol>`;
    }

    if (hasInterview) {
      practiceHtml += `
        <h3 style="color: var(--primary-green); margin-top: 14px;">Conceptual Interview Q&A</h3>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
      `;
      enhancements.interviewQuestions!.forEach((q, idx) => {
        practiceHtml += `
          <div style="margin-bottom: 8px;">
            <strong>Q${idx + 1}: ${q.question}</strong>
            <p style="margin-top: 4px; font-style: italic; color: #475569; margin-bottom: 0;">Answer: ${q.answer}</p>
          </div>
        `;
      });
      practiceHtml += `</div>`;
    }

    pageBody.append(practiceHtml);
  }

  return $.html();
}
