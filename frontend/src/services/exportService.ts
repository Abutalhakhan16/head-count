import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Lecture, AttendanceSummaryStats } from '../types';

export const exportService = {
  exportToCSV(lectures: Lecture[], filename = 'classroom_attendance_report.csv'): void {
    const headers = [
      'Lecture ID',
      'Title',
      'Subject Code',
      'Subject Name',
      'Classroom',
      'Faculty',
      'Date',
      'Day',
      'Time Slot',
      'Enrolled',
      'Present Count',
      'Peak Count',
      'Occupancy %',
      'Status'
    ];

    const rows = lectures.map(l => [
      l.id,
      `"${l.title.replace(/"/g, '""')}"`,
      l.subjectCode,
      `"${l.subjectName.replace(/"/g, '""')}"`,
      `"${l.classroomName.replace(/"/g, '""')}"`,
      `"${l.facultyName.replace(/"/g, '""')}"`,
      l.date,
      l.dayOfWeek,
      `${l.startTime} - ${l.endTime}`,
      l.enrolledStudents,
      l.presentStudents,
      l.peakStudents,
      `${l.averageOccupancyPercent}%`,
      l.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportToPDF(
    lectures: Lecture[],
    summary: AttendanceSummaryStats,
    title = 'Smart Classroom Analytics Attendance Report'
  ): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Brand Header
    doc.setFillColor(15, 23, 42); // Navy 900
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SMART CLASSROOM ANALYTICS', 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-POWERED CCTV HEADCOUNT & ATTENDANCE VERIFICATION SYSTEM', 14, 18);

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 15);

    // Summary Statistics Cards
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE ATTENDANCE SUMMARY', 14, 34);

    const statBoxWidth = 43;
    const statBoxHeight = 18;
    const startY = 38;

    const stats = [
      { label: 'Current Detected', value: `${summary.currentDetected} students` },
      { label: 'Total Enrolled', value: `${summary.totalEnrolled} students` },
      { label: 'Room Occupancy', value: `${summary.occupancyPercentage}%` },
      { label: '7-Day Average', value: `${summary.average7Days} students` },
      { label: 'Highest Recorded', value: `${summary.highestAttendance} students` },
      { 
        label: 'vs. Prev Lecture', 
        value: `${summary.changeVsPrevious.diff >= 0 ? '+' : ''}${summary.changeVsPrevious.diff} (${summary.changeVsPrevious.percentage}%)` 
      },
    ];

    stats.forEach((st, idx) => {
      const x = 14 + idx * (statBoxWidth + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, startY, statBoxWidth, statBoxHeight, 2, 2, 'FD');

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(st.label, x + 4, startY + 6);

      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(st.value, x + 4, startY + 13);
    });

    // Table of Lectures
    const tableData = lectures.map((l, index) => [
      `Lec #${lectures.length - index}`,
      l.date,
      l.dayOfWeek,
      l.subjectCode,
      l.classroomName.split('(')[0],
      l.facultyName,
      `${l.presentStudents} / ${l.enrolledStudents}`,
      `${l.averageOccupancyPercent}%`,
      l.peakStudents,
      l.status
    ]);

    autoTable(doc, {
      startY: 62,
      head: [
        ['Index', 'Date', 'Day', 'Course', 'Classroom', 'Faculty', 'Present/Enrolled', 'Occupancy', 'Peak', 'Status']
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // Brand Blue
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });

    // Footer note
    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'System Notice: Counts generated through automated computer vision person-detection and object tracking. No facial recognition or biometric identification stored.',
      14,
      finalY + 10
    );

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
};
