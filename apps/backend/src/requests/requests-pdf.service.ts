import { Injectable } from '@nestjs/common';

@Injectable()
export class RequestsPdfService {
  async generateMedicalPdf(data: any): Promise<Buffer> {
    const student = data.student || {};
    const user = student.user || {};
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    const rowsHtml = subjects
      .map(
        (sub: any, idx: number) => `
      <tr style="border-bottom: 1px solid #000;">
        <td style="border-right: 1px solid #000; padding: 6px; text-align: center;">${String(idx + 1).padStart(2, '0')}</td>
        <td style="border-right: 1px solid #000; padding: 6px;">${sub.date || ''}</td>
        <td style="border-right: 1px solid #000; padding: 6px; font-family: monospace;">${sub.course_code || ''}</td>
        <td style="padding: 6px;">${sub.title || ''}</td>
      </tr>
    `,
      )
      .join('');

    // Pad the table to at least 8 rows for that hand-out feel
    const emptyRowsCount = Math.max(0, 8 - subjects.length);
    const emptyRowsHtml = Array.from({ length: emptyRowsCount })
      .map(
        (_, idx) => `
      <tr style="border-bottom: 1px solid #000; height: 28px;">
        <td style="border-right: 1px solid #000; padding: 6px; text-align: center;">${String(subjects.length + idx + 1).padStart(2, '0')}</td>
        <td style="border-right: 1px solid #000; padding: 6px;"></td>
        <td style="border-right: 1px solid #000; padding: 6px;"></td>
        <td style="padding: 6px;"></td>
      </tr>
    `,
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Medical Certificate Submission Form</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 40px;
            font-size: 14px;
            color: #000;
            line-height: 1.4;
          }
          .header-banner {
            background-color: #0c4a6e;
            color: white;
            padding: 8px 15px;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 20px;
          }
          .form-title-section {
            text-align: center;
            margin-bottom: 20px;
          }
          .university-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .form-subtitle {
            font-style: italic;
            font-weight: bold;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .office-use-box {
            border: 2px solid #000;
            float: right;
            padding: 4px 10px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .clear {
            clear: both;
          }
          .field-row {
            margin-bottom: 12px;
            display: flex;
          }
          .field-label {
            width: 200px;
            font-weight: bold;
          }
          .field-dots {
            flex-grow: 1;
            border-bottom: 1px dotted #000;
            padding-bottom: 2px;
          }
          .exam-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000;
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .exam-table th {
            border: 1px solid #000;
            background-color: #f2f2f2;
            padding: 8px;
            font-weight: bold;
            text-align: left;
          }
          .footer-note {
            margin-top: 30px;
            font-size: 13px;
          }
          .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .sig-line {
            width: 200px;
            border-top: 1px dotted #000;
            text-align: center;
            padding-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <span>Faculty of Technology</span>
          <span>Student Handbook</span>
        </div>

        <div class="office-use-box">
          For Office use only [ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]
        </div>
        <div class="clear"></div>

        <div class="form-title-section">
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px;">8.2. Medical Certificate Submission Form</div>
          <div class="university-title">FACULTY OF TECHNOLOGY</div>
          <div class="university-title">RAJARATA UNIVERSITY OF SRI LANKA</div>
          <div class="form-subtitle">To be filled by the students who absent to Examination</div>
        </div>

        <div class="field-row">
          <div class="field-label">01. Registration No</div>
          <div class="field-dots" style="font-weight: bold;">${student.registration_number || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">02. Index No.</div>
          <div class="field-dots" style="font-weight: bold;">${student.index_number || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">03. Name with initials – (Mr./Ms.)</div>
          <div class="field-dots">${user.name_with_initials || user.full_name || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">04. Name of the Examination</div>
          <div class="field-dots">${data.exam_name || ''}</div>
        </div>

        <table class="exam-table">
          <thead>
            <tr>
              <th style="width: 8%; border-right: 1px solid #000; text-align: center;">S/N</th>
              <th style="width: 25%; border-right: 1px solid #000;">Date of the Exam</th>
              <th style="width: 22%; border-right: 1px solid #000;">Course Code</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${emptyRowsHtml}
          </tbody>
        </table>

        <div class="footer-note">
          Submit this form to the office with a Medical Certificate and a Request Letter.
        </div>

        <div class="signatures">
          <div class="sig-line">
            Date
          </div>
          <div class="sig-line">
            Signature of Student
          </div>
        </div>
      </body>
      </html>
    `;

    return this.renderHtmlToPdf(htmlContent);
  }

  async generateGraceChancePdf(data: any): Promise<Buffer> {
    const student = data.student || {};
    const user = student.user || {};
    const incompleteSubjects = Array.isArray(data.incomplete_subjects)
      ? data.incomplete_subjects
      : [];

    const rowsHtml = incompleteSubjects
      .map((sub: any) => {
        const att1 = sub.attempts?.first || {};
        const att2 = sub.attempts?.second || {};
        const att3 = sub.attempts?.third || {};
        return `
        <tr style="border-bottom: 1px solid #000;">
          <td style="border-right: 1px solid #000; padding: 4px; text-align: left; font-size: 11px;">
            ${sub.code || ''} - ${sub.title || ''}
          </td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center; font-size: 11px;">${att1.year || ''}</td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center; font-size: 11px;">${att1.semester || ''}</td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center; font-size: 11px;">${att2.year || ''}</td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center; font-size: 11px;">${att2.semester || ''}</td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center; font-size: 11px;">${att3.year || ''}</td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center; font-size: 11px;">${att3.semester || ''}</td>
          <td style="padding: 4px; text-align: center; font-size: 11px;">${sub.credits || ''}</td>
        </tr>
      `;
      })
      .join('');

    const emptyRowsCount = Math.max(0, 4 - incompleteSubjects.length);
    const emptyRowsHtml = Array.from({ length: emptyRowsCount })
      .map(
        () => `
      <tr style="border-bottom: 1px solid #000; height: 24px;">
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="border-right: 1px solid #000; padding: 4px;"></td>
        <td style="padding: 4px;"></td>
      </tr>
    `,
      )
      .join('');

    const regDateStr = data.date_of_registration
      ? new Date(data.date_of_registration).toLocaleDateString()
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Grace Chance Application Form</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 30px;
            font-size: 13px;
            color: #000;
            line-height: 1.35;
          }
          .header-banner {
            background-color: #0c4a6e;
            color: white;
            padding: 6px 15px;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 15px;
          }
          .form-title-section {
            text-align: center;
            margin-bottom: 15px;
          }
          .university-title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 3px;
            text-decoration: underline;
          }
          .clear {
            clear: both;
          }
          .field-row {
            margin-bottom: 10px;
            display: flex;
          }
          .field-label {
            width: 250px;
            font-weight: bold;
          }
          .field-dots {
            flex-grow: 1;
            border-bottom: 1px dotted #000;
            padding-bottom: 2px;
          }
          .nested-fields {
            margin-left: 20px;
            margin-bottom: 8px;
          }
          .exam-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000;
            margin-top: 15px;
            margin-bottom: 15px;
          }
          .exam-table th {
            border: 1px solid #000;
            background-color: #f2f2f2;
            padding: 6px;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
          }
          .declarations {
            margin-top: 15px;
            font-size: 12px;
          }
          .signatures {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
          }
          .sig-line {
            width: 220px;
            border-top: 1px dotted #000;
            text-align: center;
            padding-top: 5px;
          }
          .office-section {
            margin-top: 40px;
            border-top: 2px solid #000;
            padding-top: 15px;
          }
          .office-title {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 15px;
          }
          .office-signature-block {
            display: flex;
            justify-content: space-between;
            margin-top: 35px;
            font-size: 12px;
          }
          .office-sig-line {
            width: 180px;
            border-top: 1px solid #000;
            text-align: center;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <span>Faculty of Technology</span>
          <span>Student Handbook</span>
        </div>

        <div class="form-title-section">
          <div style="font-size: 12px; font-weight: bold; text-align: left; margin-bottom: 5px;">8.3. Grace Chance Application Form</div>
          <div class="university-title">The Rajarata University of Sri Lanka</div>
          <div class="university-title" style="text-decoration: none; margin-top: 3px; font-size: 14px;">Grace Chance Application Form</div>
        </div>

        <div class="field-row">
          <div class="field-label">01 &nbsp; i. Registration No</div>
          <div class="field-dots">${student.registration_number || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">&nbsp; &nbsp; &nbsp; ii. Date of Registration</div>
          <div class="field-dots">${regDateStr}</div>
        </div>
        <div class="field-row">
          <div class="field-label">02 &nbsp; Index No</div>
          <div class="field-dots">${student.index_number || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">03 &nbsp; Name of the Candidate</div>
          <div class="field-dots">${user.full_name || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">04 &nbsp; Address for Communication</div>
          <div class="field-dots">${data.address || user.address || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">05 &nbsp; Contact Phone/ Mobile No</div>
          <div class="field-dots">${data.phone || user.phone_number || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">06 &nbsp; Faculty</div>
          <div class="field-dots">${data.faculty || 'Technology'}</div>
        </div>

        <div class="field-row" style="margin-top: 15px;">
          <div class="field-label">07 &nbsp; a. Total No. of Credits in Degree Programme</div>
          <div class="field-dots">${data.total_credits || ''}</div>
        </div>

        <div class="nested-fields">
          <div class="field-row">
            <div style="width: 150px; font-weight: bold;">b. No. of Credits for</div>
            <div style="width: 100px;">i. Internship</div>
            <div class="field-dots">${data.internship_credits || '0'}</div>
          </div>
          <div class="field-row">
            <div style="width: 150px;"></div>
            <div style="width: 100px;">ii. Research</div>
            <div class="field-dots">${data.research_credits || '0'}</div>
          </div>
          <div class="field-row">
            <div style="width: 150px;"></div>
            <div style="width: 100px;">iii. Industrial Training</div>
            <div class="field-dots">${data.industrial_credits || '0'}</div>
          </div>
        </div>

        <div class="field-row">
          <div class="field-label">&nbsp; &nbsp; &nbsp; c. No. of Credits for the total Courses</div>
          <div class="field-dots" style="font-weight: bold;">${data.course_credits || ''}</div>
        </div>

        <div style="font-weight: bold; margin-top: 15px;">d. Details of the subject request for grace chance</div>
        <table class="exam-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 35%; border-right: 1px solid #000; border-bottom: 1px solid #000;">Incomplete Subjects</th>
              <th colspan="2" style="border-right: 1px solid #000; border-bottom: 1px solid #000;">1<sup>st</sup> Attempt</th>
              <th colspan="2" style="border-right: 1px solid #000; border-bottom: 1px solid #000;">2<sup>nd</sup> Attempt</th>
              <th colspan="2" style="border-right: 1px solid #000; border-bottom: 1px solid #000;">3<sup>rd</sup> Attempt</th>
              <th rowspan="2" style="border-bottom: 1px solid #000;">Assigned Credits</th>
            </tr>
            <tr>
              <th style="border-right: 1px solid #000; font-size: 10px;">Year</th>
              <th style="border-right: 1px solid #000; font-size: 10px;">Sem</th>
              <th style="border-right: 1px solid #000; font-size: 10px;">Year</th>
              <th style="border-right: 1px solid #000; font-size: 10px;">Sem</th>
              <th style="border-right: 1px solid #000; font-size: 10px;">Year</th>
              <th style="border-right: 1px solid #000; font-size: 10px;">Sem</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${emptyRowsHtml}
          </tbody>
        </table>

        <div class="field-row">
          <div class="field-label">&nbsp; &nbsp; &nbsp; e. Total No. of Incomplete Credits</div>
          <div class="field-dots">${data.total_incomplete_credits || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">&nbsp; &nbsp; &nbsp; f. Credit percentage for the incomplete subjects</div>
          <div class="field-dots">${data.credit_percentage || ''}%</div>
        </div>

        <div class="declarations">
          <p><strong>I hereby declare that,</strong></p>
          <ol>
            <li>The information furnished in this application is true, correct and complete.</li>
            <li>I am appearing for all failed subjects.</li>
            <li>I am fully aware that this is a special grace chance for the examination to candidates. (Who have exhausted their legitimate chances to complete the degree in the final attempts)</li>
            <li>I will do <strong>NOT</strong> claim any more chances for writing the examination in this semester.</li>
          </ol>
        </div>

        <div class="signatures">
          <div class="sig-line">Signature of the Student</div>
          <div class="sig-line">Date</div>
        </div>

        <div class="office-section">
          <div class="office-title">Official Use only</div>
          <div class="office-signature-block">
            <div style="text-align: left;">
              <div style="font-weight: bold; margin-bottom: 25px;">01 Checked by Subject Clerk of the Faculty</div>
              <div class="office-sig-line">Signature of the Subject Clerk</div>
              <div style="margin-top: 5px;">Date: .........................</div>
            </div>
            <div style="text-align: left;">
              <div style="font-weight: bold; margin-bottom: 25px;">02 Certified by DR/SAR/AR of the Faculty</div>
              <div class="office-sig-line">Signature of the DR/SAR/AR</div>
            </div>
          </div>
          <div class="office-signature-block" style="margin-top: 40px;">
            <div style="text-align: left;">
              <div style="font-weight: bold; margin-bottom: 25px;">03 Recommended / Not recommended</div>
              <div class="office-sig-line">Head of the Department</div>
            </div>
            <div style="text-align: left;">
              <div style="font-weight: bold; margin-bottom: 25px;">04 Recommended / Not recommended by Faculty Board</div>
              <div class="office-sig-line">Signature of Dean</div>
              <div style="margin-top: 5px;">Faculty Board No: ......................... Date: .............</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.renderHtmlToPdf(htmlContent);
  }

  async generateRecorrectionPdf(data: any): Promise<Buffer> {
    const student = data.student || {};
    const user = student.user || {};
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    const rowsHtml = subjects
      .map(
        (sub: any) => `
      <tr style="border-bottom: 1px solid #000;">
        <td style="border-right: 1px solid #000; padding: 6px; text-align: center;">${sub.exam_type || 'End-Semester'}</td>
        <td style="border-right: 1px solid #000; padding: 6px; font-family: monospace;">${sub.course_code || ''} - ${sub.course_name || ''}</td>
        <td style="border-right: 1px solid #000; padding: 6px; text-align: center;">${sub.marks_received ?? ''}</td>
        <td style="padding: 6px; text-align: center;">${sub.grade_received || ''}</td>
      </tr>
    `,
      )
      .join('');

    const emptyRowsCount = Math.max(0, 5 - subjects.length);
    const emptyRowsHtml = Array.from({ length: emptyRowsCount })
      .map(
        () => `
      <tr style="border-bottom: 1px solid #000; height: 28px;">
        <td style="border-right: 1px solid #000; padding: 6px;"></td>
        <td style="border-right: 1px solid #000; padding: 6px;"></td>
        <td style="border-right: 1px solid #000; padding: 6px;"></td>
        <td style="padding: 6px;"></td>
      </tr>
    `,
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Application for Verification of Examination Marks</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 30px;
            font-size: 13px;
            color: #000;
            line-height: 1.35;
          }
          .header-banner {
            background-color: #0c4a6e;
            color: white;
            padding: 6px 15px;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 15px;
          }
          .form-title-section {
            text-align: center;
            margin-bottom: 20px;
          }
          .annexure-tag {
            text-align: right;
            font-style: italic;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .university-title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 3px;
            text-decoration: underline;
          }
          .candidate-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            margin-bottom: 15px;
          }
          .candidate-table td {
            border: 1px solid #000;
            padding: 6px;
          }
          .label-col {
            font-weight: bold;
            width: 25%;
            background-color: #f9f9f9;
          }
          .exam-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000;
            margin-top: 15px;
            margin-bottom: 15px;
          }
          .exam-table th {
            border: 1px solid #000;
            background-color: #f2f2f2;
            padding: 6px;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
          }
          .signatures {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
          }
          .sig-line {
            width: 220px;
            border-top: 1px dotted #000;
            text-align: center;
            padding-top: 5px;
          }
          .office-section {
            margin-top: 30px;
            border-top: 2px dashed #000;
            padding-top: 15px;
          }
          .office-title {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <span>Faculty of Technology</span>
          <span>Student Handbook</span>
        </div>

        <div class="annexure-tag">Annexure 1</div>
        
        <div class="form-title-section">
          <div class="university-title">Application Form For Verification of Examination Marks & Grades</div>
          <div style="font-weight: bold; margin-top: 5px;">Faculty of Technology, Rajarata University of Sri Lanka</div>
        </div>

        <div style="font-weight: bold; margin-bottom: 8px;">1. Details of the Candidate</div>
        <table class="candidate-table">
          <tr>
            <td class="label-col">Name of the Candidate</td>
            <td colspan="3">${user.full_name || ''}</td>
          </tr>
          <tr>
            <td class="label-col">Registration No.</td>
            <td style="width: 30%;">${student.registration_number || ''}</td>
            <td class="label-col" style="width: 20%;">Index No.</td>
            <td>${student.index_number || ''}</td>
          </tr>
          <tr>
            <td class="label-col">Year</td>
            <td>${student.academic_year || ''}</td>
            <td class="label-col">Semester</td>
            <td>${data.semester || ''}</td>
          </tr>
        </table>

        <div style="font-weight: bold; margin-top: 15px; margin-bottom: 8px;">2. Assessment(s) to be verified</div>
        <table class="exam-table">
          <thead>
            <tr>
              <th style="width: 25%; border-right: 1px solid #000;">End-Semester / Final Exam</th>
              <th style="width: 45%; border-right: 1px solid #000;">Course / Subject</th>
              <th style="width: 15%; border-right: 1px solid #000;">Marks Received</th>
              <th>Grade Received</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${emptyRowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 15px; font-size: 13px;">
          Total amount paid: <strong>Rs. ${data.total_amount_paid || '0.00'}</strong> &nbsp;(at the rate of Rs. 500/- per Course/Subject/Examination)
          <br>
          <i>(Original receipt should be attached)</i>
        </div>

        <div class="signatures">
          <div>Date: ${new Date().toLocaleDateString()}</div>
          <div class="sig-line">Signature of the Candidate</div>
        </div>

        <div class="office-section">
          <div class="office-title">FOR OFFICE USE :</div>
          <div style="font-weight: bold; margin-bottom: 10px;">Results after Verification</div>
          <table class="exam-table">
            <thead>
              <tr>
                <th style="width: 25%; border-right: 1px solid #000;">End-Semester / Final Exam</th>
                <th style="width: 45%; border-right: 1px solid #000;">Course / Subject</th>
                <th style="width: 15%; border-right: 1px solid #000;">Marks Received</th>
                <th style="width: 15%; border-right: 1px solid #000;">Grade Received</th>
                <th>Changed / Not Changed</th>
              </tr>
            </thead>
            <tbody>
              ${subjects
                .map(
                  (sub: any) => `
                <tr style="border-bottom: 1px solid #000; height: 28px;">
                  <td style="border-right: 1px solid #000; padding: 6px;">${sub.exam_type || 'End-Semester'}</td>
                  <td style="border-right: 1px solid #000; padding: 6px; font-family: monospace;">${sub.course_code || ''}</td>
                  <td style="border-right: 1px solid #000; padding: 6px;"></td>
                  <td style="border-right: 1px solid #000; padding: 6px;"></td>
                  <td></td>
                </tr>
              `,
                )
                .join('')}
              ${Array.from({ length: Math.max(0, 3 - subjects.length) })
                .map(
                  () => `
                <tr style="border-bottom: 1px solid #000; height: 28px;">
                  <td style="border-right: 1px solid #000; padding: 6px;"></td>
                  <td style="border-right: 1px solid #000; padding: 6px;"></td>
                  <td style="border-right: 1px solid #000; padding: 6px;"></td>
                  <td style="border-right: 1px solid #000; padding: 6px;"></td>
                  <td></td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>

          <div style="font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Name and Signature of Verification Board Member:</div>
          <table class="exam-table" style="margin-top: 5px;">
            <thead>
              <tr>
                <th style="width: 35%; border-right: 1px solid #000;">Name</th>
                <th style="width: 35%; border-right: 1px solid #000;">Designation</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              <tr style="height: 28px; border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td></td>
              </tr>
              <tr style="height: 28px; border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div style="font-size: 11px; font-style: italic; margin-top: 10px;">
            Note: In the case of final examination relevant minutes of the Special Result Board and the Senate must be attached.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.renderHtmlToPdf(htmlContent);
  }

  private async renderHtmlToPdf(htmlContent: string): Promise<Buffer> {
    // Dynamic import to prevent compilation crash if npm install is still finalizing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px',
        },
        printBackground: true,
      });
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
}
