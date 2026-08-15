/**
 * Smart Context-Adaptive Action & Sentiment Intelligence Utilities
 */

// Generate .ics iCalendar file and trigger download
export const downloadIcsFile = (title, startDate, durationMinutes = 60, description = '') => {
  const formatDate = (date) => {
    return date.toISOString().replace(/-|:|\.\d+/g, '');
  };

  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexus Chat//Event Schedule//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@nexuschat.app`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

// Generate Google Calendar Link
export const getGoogleCalendarUrl = (title, startDate, durationMinutes = 60) => {
  const formatGDate = (d) => d.toISOString().replace(/-|:|\.\d+/g, '');
  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGDate(start)}/${formatGDate(end)}`;
};

// Detect Smart Actions from message text
export const detectSmartActions = (text) => {
  if (!text || typeof text !== 'string') return [];
  const actions = [];

  // 1. Date / Meeting Time detection
  const timeRegex = /(?:tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?)\s*(?:at|@)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    const matchedSnippet = timeMatch[0];
    const now = new Date();
    // Default scheduled time: tomorrow or next hour
    const eventTime = new Date(now.getTime() + 24 * 3600000);
    actions.push({
      type: 'calendar',
      label: `📅 Add to Calendar`,
      title: 'Meeting / Event',
      snippet: matchedSnippet,
      date: eventTime,
    });
  }

  // 2. UPI Payment / Currency Detection
  const upiRegex = /([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})|(?:₹|rs\.?|inr|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i;
  const upiMatch = text.match(upiRegex);
  if (upiMatch) {
    const upiId = upiMatch[1];
    const amount = upiMatch[2];
    actions.push({
      type: 'payment',
      label: upiId ? `💳 Copy UPI: ${upiId}` : `💳 Pay Amount`,
      upiId: upiId || null,
      amount: amount || null,
    });
  }

  // 3. URLs
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const urlMatch = text.match(urlRegex);
  if (urlMatch && !urlMatch[0].includes('youtube.com') && !urlMatch[0].includes('youtu.be')) {
    actions.push({
      type: 'link',
      label: `🌐 Open Link`,
      url: urlMatch[0],
    });
  }

  // 4. Location / Maps
  const locRegex = /(?:location|address|meet at|near)\s+([a-zA-Z0-9\s,]{4,40})/i;
  const locMatch = text.match(locRegex);
  if (locMatch) {
    actions.push({
      type: 'maps',
      label: `🗺️ Open in Maps`,
      location: locMatch[1].trim(),
    });
  }

  return actions;
};

// Client-Side Sentiment Tone Classifier
export const detectSentimentTone = (messages) => {
  if (!messages || messages.length === 0) return 'calm';

  // Analyze last 5 messages
  const recentText = messages
    .slice(-5)
    .map((m) => m.content || '')
    .join(' ')
    .toLowerCase();

  const joyKeywords = ['congrats', 'congratulations', 'happy', 'yay', 'awesome', 'great', 'love', 'amazing', 'haha', 'lol', 'party', 'cheers', '🎉', '🔥', '❤️', '🚀', '🥳'];
  const urgentKeywords = ['urgent', 'emergency', 'asap', 'quick', 'hurry', 'alert', 'immediately', 'help', 'critical', 'warning', '⚠️', '🚨'];
  const formalKeywords = ['regards', 'please find', 'attached', 'proposal', 'agreement', 'kindly', 'sincerely', 'meeting agenda'];

  let joyScore = 0;
  let urgentScore = 0;
  let formalScore = 0;

  joyKeywords.forEach((k) => {
    if (recentText.includes(k)) joyScore++;
  });
  urgentKeywords.forEach((k) => {
    if (recentText.includes(k)) urgentScore++;
  });
  formalKeywords.forEach((k) => {
    if (recentText.includes(k)) formalScore++;
  });

  if (urgentScore > 1) return 'urgent';
  if (joyScore > 1) return 'joy';
  if (formalScore > 1) return 'formal';
  return 'calm';
};
