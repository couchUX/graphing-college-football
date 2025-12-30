import React, { useState, useEffect, useMemo } from 'react';
import { fetchSPRatings, SPRating } from '../services/ratingsApi';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { ChevronUp, ChevronDown, ChevronsUpDown, Info, X, BookOpen, Copy, Check, BarChart3 } from 'lucide-react';
import Toast from './Toast';
import logo from '../assets/graphing-cfb-logo-2.png';

type SortField = 'ranking' | 'team' | 'conference' | 'rating' | 'offense' | 'defense' | 'specialTeams';
type SortDirection = 'asc' | 'desc';

const RatingsPage: React.FC = () => {
  const [year, setYear] = useState<number>(2025);
  const [ratings, setRatings] = useState<SPRating[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('rating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedConference, setSelectedConference] = useState<string>('all');
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showDataDefinitions, setShowDataDefinitions] = useState<boolean>(false);
  const [expandedTop25, setExpandedTop25] = useState<boolean>(false);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState<boolean>(false);
  const [copiedEmbedKey, setCopiedEmbedKey] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Generate year options (2005-2025)
  const yearOptions = Array.from({ length: 21 }, (_, i) => 2025 - i);

  // Get unique conferences from ratings
  const conferences = useMemo(() => {
    const uniqueConferences = Array.from(
      new Set(ratings.map(r => r.conference).filter(Boolean))
    ).sort();
    return ['all', 'power4', ...uniqueConferences];
  }, [ratings]);

  // Power 4 conferences
  const power4Conferences = ['ACC', 'SEC', 'Big 12', 'Big Ten'];

  // Conference abbreviation mapping
  const getConferenceAbbreviation = (conference: string | undefined): string => {
    if (!conference) return 'N/A';

    const abbreviations: Record<string, string> = {
      'Mountain West': 'MWC',
      'American Athletic': 'AAC',
      'American': 'AAC',
      'FBS Independents': 'N/A',
      'Independents': 'N/A',
      'Mid-American': 'MAC',
      'Conference USA': 'CUSA',
      'Sun Belt': 'Sun Belt',
      'ACC': 'ACC',
      'SEC': 'SEC',
      'Big 12': 'Big 12',
      'Big Ten': 'Big Ten',
      'Pac-12': 'Pac-12'
    };

    return abbreviations[conference] || conference;
  };

  useEffect(() => {
    const loadRatings = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSPRatings(year);
        // Filter out "National Average" if it exists
        const filteredData = data.filter(r =>
          r.team &&
          r.team.toLowerCase() !== 'national average' &&
          r.team.toLowerCase() !== 'ncaa average' &&
          r.team.toLowerCase() !== 'nationalaverages'
        );
        setRatings(filteredData);
      } catch (err) {
        setError('Failed to load SP+ ratings. Please try again.');
        console.error('Error loading ratings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRatings();
  }, [year]);

  useEffect(() => {
    if (!copiedEmbedKey) return;

    const timer = window.setTimeout(() => setCopiedEmbedKey(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedEmbedKey]);

  const escapeHtml = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const generateTop25EmbedCode = (
    title: string,
    rows: SPRating[],
    columnLabel: string,
    ratingType: 'overall' | 'offense' | 'defense'
  ): string => {
    const uniqueId = `sp-ratings-${ratingType}-${Math.random().toString(36).slice(2, 10)}`;

    const contextParts = [`Season ${year}`];
    if (selectedConference === 'power4') {
      contextParts.push('Power 4 conferences');
    } else if (selectedConference !== 'all') {
      contextParts.push(`${selectedConference} only`);
    }
    const subtitle = contextParts.join(' • ');

    const urlParams = new URLSearchParams();
    urlParams.set('year', year.toString());
    if (selectedConference !== 'all') {
      urlParams.set('conference', selectedConference);
    }
    const ratingsUrl = `https://graphingcollegefootball.com/ratings${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;

    const maxRating = 40;

    const tableRows = rows.slice(0, 25).map((rating, index) => {
      let ratingValue: number | null = null;

      if (ratingType === 'overall') {
        ratingValue = typeof rating.rating === 'number' ? rating.rating : null;
      } else if (ratingType === 'offense') {
        ratingValue = rating.offense?.rating ?? null;
      } else {
        ratingValue = rating.defense?.rating ?? null;
      }

      const ratingDisplay = ratingValue !== null && !Number.isNaN(ratingValue)
        ? ratingValue.toFixed(1)
        : 'N/A';

      const teamColors = getDisplayTeamColors(rating.team, 'default');
      const teamColor = teamColors.success || '#1f2937';
      const colorDot = teamColor;
      const barColor = teamColor;

      // Calculate bar properties (matching app logic)
      let barPercent = 0;
      let barPosition = 'left'; // 'left' or 'right'

      if (ratingValue !== null && !Number.isNaN(ratingValue)) {
        if (ratingValue >= 0) {
          barPercent = Math.min(100, (ratingValue / maxRating) * 100);
          barPosition = 'left';
        } else {
          barPercent = Math.min(100, (Math.abs(ratingValue) / maxRating) * 100);
          barPosition = 'right';
        }
        // Ensure minimum 3% width for visibility
        barPercent = Math.max(barPercent, 3);
      }

      return `
        <tr class="${index % 2 === 0 ? `${uniqueId}-row-even` : `${uniqueId}-row-odd`}">
          <td class="${uniqueId}-cell-rank">${index + 1}</td>
          <td class="${uniqueId}-cell-team">
            <span class="${uniqueId}-team-dot" style="background-color: ${colorDot};"></span>
            <span class="${uniqueId}-team-name">${escapeHtml(rating.team)}</span>
          </td>
          <td class="${uniqueId}-cell-value">
            <div class="${uniqueId}-value-container">
              <span class="${uniqueId}-value-text">${escapeHtml(ratingDisplay)}</span>
              <div class="${uniqueId}-bar-track">
                <div class="${uniqueId}-bar-fill" style="width: ${barPercent}%; background-color: ${barColor}; ${barPosition}: 0;"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - SP+ Ratings</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 16px;
      background: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      color: #0f172a;
    }

    .${uniqueId}-container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
      overflow: hidden;
    }

    .${uniqueId}-header {
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #0f172a, #1f2937);
      color: #ffffff;
    }

    .${uniqueId}-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .${uniqueId}-subtitle {
      margin: 6px 0 0 0;
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.75);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
    }

    thead {
      background: #111827;
      color: #ffffff;
    }

    thead th {
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: left;
    }

    col.${uniqueId}-col-rank { width: 48px; }
    col.${uniqueId}-col-team { width: 35%; }
    col.${uniqueId}-col-value { width: auto; }

    tbody tr {
      border-bottom: 1px solid rgba(148, 163, 184, 0.35);
    }

    .${uniqueId}-row-even { background: #ffffff; }
    .${uniqueId}-row-odd { background: #f8fafc; }

    td {
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
      color: #0f172a;
    }

    .${uniqueId}-cell-rank {
      font-weight: 600;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }

    .${uniqueId}-cell-team {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      color: #111827;
    }

    .${uniqueId}-team-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 9999px;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12);
    }

    .${uniqueId}-team-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .${uniqueId}-cell-value {
      padding: 12px 16px;
    }

    .${uniqueId}-value-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .${uniqueId}-value-text {
      width: 48px;
      text-align: left;
      flex-shrink: 0;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
    }

    .${uniqueId}-bar-track {
      flex: 1;
      height: 16px;
      background: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
      position: relative;
      min-width: 100px;
    }

    .${uniqueId}-bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease;
      position: absolute;
    }

    .${uniqueId}-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #ffffff;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #6b7280;
    }

    .${uniqueId}-footer a {
      color: #6b7280;
      font-weight: 400;
      text-decoration: none;
    }

    .${uniqueId}-footer a:hover {
      color: #374151;
      text-decoration: none;
    }

    @media (max-width: 520px) {
      body { padding: 12px; }
      .${uniqueId}-header { padding: 16px 18px 12px; }
      thead th, td { padding: 10px 12px; font-size: 13px; }
      col.${uniqueId}-col-rank { width: 40px; }
      col.${uniqueId}-col-team { width: 38%; }
      col.${uniqueId}-col-value { width: auto; }
      .${uniqueId}-cell-value { padding: 10px 12px; }
      .${uniqueId}-value-text { width: 36px; font-size: 13px; }
      .${uniqueId}-bar-track { min-width: 60px; }
    }
  </style>
</head>
<body>
  <div class="${uniqueId}-container">
    <div class="${uniqueId}-header">
      <h2 class="${uniqueId}-title">${escapeHtml(title)}</h2>
      ${subtitle ? `<div class="${uniqueId}-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <table>
      <colgroup>
        <col class="${uniqueId}-col-rank" />
        <col class="${uniqueId}-col-team" />
        <col class="${uniqueId}-col-value" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>${escapeHtml(columnLabel)}</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <div class="${uniqueId}-footer">
      <a href="${ratingsUrl}" target="_blank" rel="noopener noreferrer">See all ratings</a>
      <span>Data: SP+ ratings</span>
    </div>
  </div>
</body>
</html>`;
  };

  const copyTop25EmbedToClipboard = async (embedKey: string, embedHTML: string, toastLabel: string) => {
    if (!embedHTML) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(embedHTML);
        setCopiedEmbedKey(embedKey);
        setToastMessage(`Embed code copied for ${toastLabel}`);
        setShowToast(true);
      } else {
        console.warn('Clipboard API not available in this browser.');
        setToastMessage('Clipboard not available in this browser');
        setShowToast(true);
      }
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      setToastMessage('Failed to copy embed code. Please try again.');
      setShowToast(true);
    }
  };

  // Contact form handlers
  const handleContactFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContactFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingContact) return;

    setIsSubmittingContact(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm),
      });

      if (response.ok) {
        alert('Message sent successfully! I\'ll get back to you soon.');
        setContactForm({ name: '', email: '', message: '' });
        setShowContactModal(false);
      } else {
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending contact form:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter ratings by conference
  const filteredRatings = useMemo(() => {
    if (selectedConference === 'all') {
      return ratings;
    }
    if (selectedConference === 'power4') {
      return ratings.filter(r => r.conference && power4Conferences.includes(r.conference));
    }
    return ratings.filter(r => r.conference === selectedConference);
  }, [ratings, selectedConference, power4Conferences]);

  // Sort ratings based on current sort field and direction
  const sortedRatings = useMemo(() => {
    const sorted = [...filteredRatings].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case 'ranking':
          aValue = a.ranking;
          bValue = b.ranking;
          break;
        case 'team':
          aValue = a.team.toLowerCase();
          bValue = b.team.toLowerCase();
          break;
        case 'conference':
          aValue = (a.conference || '').toLowerCase();
          bValue = (b.conference || '').toLowerCase();
          break;
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        case 'offense':
          aValue = a.offense?.rating || -999;
          bValue = b.offense?.rating || -999;
          break;
        case 'defense':
          aValue = a.defense?.rating || -999;
          bValue = b.defense?.rating || -999;
          break;
        case 'specialTeams':
          aValue = a.specialTeams?.rating || -999;
          bValue = b.specialTeams?.rating || -999;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [filteredRatings, sortField, sortDirection]);

  // Get top 25 teams for each category
  const top25Overall = useMemo(() => {
    return [...ratings]
      .filter(r => {
        if (selectedConference === 'all') return true;
        if (selectedConference === 'power4') return r.conference && power4Conferences.includes(r.conference);
        return r.conference === selectedConference;
      })
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 25);
  }, [ratings, selectedConference, power4Conferences]);

  const top25Offense = useMemo(() => {
    return [...ratings]
      .filter(r => {
        if (!r.offense?.rating) return false;
        if (selectedConference === 'all') return true;
        if (selectedConference === 'power4') return r.conference && power4Conferences.includes(r.conference);
        return r.conference === selectedConference;
      })
      .sort((a, b) => (b.offense?.rating || 0) - (a.offense?.rating || 0))
      .slice(0, 25);
  }, [ratings, selectedConference, power4Conferences]);

  const top25Defense = useMemo(() => {
    return [...ratings]
      .filter(r => {
        if (!r.defense?.rating) return false;
        if (selectedConference === 'all') return true;
        if (selectedConference === 'power4') return r.conference && power4Conferences.includes(r.conference);
        return r.conference === selectedConference;
      })
      .sort((a, b) => (a.defense?.rating || 0) - (b.defense?.rating || 0)) // Lower is better for defense
      .slice(0, 25);
  }, [ratings, selectedConference, power4Conferences]);

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 text-neutral-400" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4 text-white" />
      : <ChevronDown className="h-4 w-4 text-white" />;
  };

  const getHeaderCellClass = (field: SortField, paddingClass = 'px-4') => {
    const baseClasses = `${paddingClass} py-3 text-left text-sm font-semibold cursor-pointer transition-colors text-white`;
    return sortField === field
      ? `${baseClasses} bg-neutral-700`
      : `${baseClasses} hover:bg-neutral-700`;
  };

  // Render a top 25 table for a specific rating type
  const renderTop25Table = (
    title: string,
    data: SPRating[],
    ratingType: 'overall' | 'offense' | 'defense',
    columnLabel: string,
    isExpanded: boolean,
    onToggle: () => void,
    isConferenceFiltered: boolean
  ) => {
    const embedKey = `${ratingType}-${selectedConference}-${year}`;
    const embedDisabled = data.length === 0;
    const isEmbedCopied = copiedEmbedKey === embedKey;

    const handleCopyEmbed = async () => {
      if (embedDisabled) return;
      const embedHTML = generateTop25EmbedCode(title, data, columnLabel, ratingType);
      await copyTop25EmbedToClipboard(embedKey, embedHTML, title);
    };

    const maxRating = 40;
    // If conference filtered, show all teams. Otherwise, show 12 or 25 based on expanded state
    const displayData = isConferenceFiltered ? data : (isExpanded ? data : data.slice(0, 12));

    const getBarProperties = (value: number) => {
      if (value >= 0) {
        return {
          percent: Math.min(100, (value / maxRating) * 100),
          isNegative: false
        };
      } else {
        return {
          percent: Math.min(100, (Math.abs(value) / maxRating) * 100),
          isNegative: true
        };
      }
    };

    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="bg-neutral-600 px-4 py-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={handleCopyEmbed}
            disabled={embedDisabled}
            aria-label={
              embedDisabled
                ? 'Embed unavailable until data loads'
                : isEmbedCopied
                  ? 'Embed copied'
                  : `Copy embed code for ${title}`
            }
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 ${
              embedDisabled
                ? 'border-white/20 text-white/50 cursor-not-allowed'
                : isEmbedCopied
                  ? 'border-emerald-300 bg-emerald-500/90 text-white shadow-sm'
                  : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
            }`}
            title={embedDisabled ? 'No data to embed yet' : isEmbedCopied ? 'Copied!' : 'Copy embed code'}
          >
            {isEmbedCopied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">{isEmbedCopied ? 'Copied!' : 'Copy embed'}</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <colgroup>
              <col style={{ width: '40px' }} /> {/* Index */}
              <col style={{ width: '140px' }} /> {/* Team */}
              <col style={{ width: 'auto' }} /> {/* Rating - takes remaining space */}
            </colgroup>
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700">Team</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700">{columnLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {displayData.map((rating, index) => {
                const teamColors = getDisplayTeamColors(rating.team, 'default');
                let ratingValue = 0;

                if (ratingType === 'overall') {
                  ratingValue = rating.rating;
                } else if (ratingType === 'offense') {
                  ratingValue = rating.offense?.rating || 0;
                } else if (ratingType === 'defense') {
                  ratingValue = rating.defense?.rating || 0;
                }

                const barProps = getBarProperties(ratingValue);

                return (
                  <tr
                    key={rating.team}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}
                  >
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: teamColors.success }}
                        />
                        <span className="font-medium text-neutral-900 truncate">{rating.team}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 w-12 text-left flex-shrink-0">
                          {ratingValue.toFixed(1)}
                        </span>
                        <div className="flex-1 h-4 bg-neutral-200 rounded-sm overflow-hidden relative min-w-[100px]">
                          <div
                            className="h-full rounded-sm transition-all absolute"
                            style={{
                              width: `${Math.max(barProps.percent, 3)}%`,
                              backgroundColor: teamColors.success,
                              [barProps.isNegative ? 'right' : 'left']: 0
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse Button - Only show when not conference filtered and has more than 12 teams */}
        {!isConferenceFiltered && data.length > 12 && (
          <button
            onClick={onToggle}
            className="w-full px-4 py-3 bg-neutral-50 hover:bg-neutral-100 border-t border-neutral-200 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors flex items-center justify-center gap-2"
          >
            {isExpanded ? (
              <>
                <span>Show Less</span>
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Show Top 25</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  // Render the main sortable table
  const renderMainTable = () => {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <colgroup>
              <col style={{ width: '40px' }} /> {/* Index */}
              <col style={{ width: '180px' }} /> {/* Team */}
              <col style={{ width: '140px' }} /> {/* Conference */}
              <col style={{ width: '110px' }} /> {/* SP+ Rank */}
              <col style={{ minWidth: '160px' }} /> {/* Overall SP+ */}
              <col style={{ minWidth: '140px' }} /> {/* Off Rating */}
              <col style={{ minWidth: '140px' }} /> {/* Def Rating */}
              <col style={{ minWidth: '140px' }} /> {/* Special Teams */}
            </colgroup>
            <thead className="bg-neutral-600 text-white">
              <tr>
                <th
                  className="px-3 py-3 text-left text-sm font-semibold"
                  scope="col"
                >
                  #
                </th>
                <th
                  className={getHeaderCellClass('team')}
                  onClick={() => handleSort('team')}
                >
                  <div className="flex items-center gap-2">
                    <span>Team</span>
                    {renderSortIcon('team')}
                  </div>
                </th>
                <th
                  className={getHeaderCellClass('conference')}
                  onClick={() => handleSort('conference')}
                >
                  <div className="flex items-center gap-2">
                    <span>Conference</span>
                    {renderSortIcon('conference')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                  <span>SP+ rank</span>
                </th>
                <th
                  className={getHeaderCellClass('rating')}
                  onClick={() => handleSort('rating')}
                >
                  <div className="flex items-center gap-2">
                    <span>Overall SP+</span>
                    {renderSortIcon('rating')}
                  </div>
                </th>
                <th
                  className={getHeaderCellClass('offense')}
                  onClick={() => handleSort('offense')}
                >
                  <div className="flex items-center gap-2">
                    <span>Offense</span>
                    {renderSortIcon('offense')}
                  </div>
                </th>
                <th
                  className={getHeaderCellClass('defense')}
                  onClick={() => handleSort('defense')}
                >
                  <div className="flex items-center gap-2">
                    <span>Defense</span>
                    {renderSortIcon('defense')}
                  </div>
                </th>
                <th
                  className={getHeaderCellClass('specialTeams')}
                  onClick={() => handleSort('specialTeams')}
                >
                  <div className="flex items-center gap-2">
                    <span>Special Teams</span>
                    {renderSortIcon('specialTeams')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {sortedRatings.map((rating, index) => {
                const teamColors = getDisplayTeamColors(rating.team, 'default');

                // Calculate bar widths and direction (max value of 40 for all rating types)
                const maxRating = 40;

                // For positive ratings: bar grows left to right (0 to 40)
                // For negative ratings: bar grows right to left (-40 to 0)
                const getBarProperties = (value: number) => {
                  if (value >= 0) {
                    return {
                      percent: Math.min(100, (value / maxRating) * 100),
                      isNegative: false
                    };
                  } else {
                    return {
                      percent: Math.min(100, (Math.abs(value) / maxRating) * 100),
                      isNegative: true
                    };
                  }
                };

                const overall = getBarProperties(rating.rating);
                const offense = rating.offense?.rating ? getBarProperties(rating.offense.rating) : { percent: 0, isNegative: false };
                const defense = rating.defense?.rating ? getBarProperties(rating.defense.rating) : { percent: 0, isNegative: false };
                const specialTeams = rating.specialTeams?.rating ? getBarProperties(rating.specialTeams.rating) : { percent: 0, isNegative: false };

                return (
                  <tr
                    key={rating.team}
                    className={index % 2 === 0 ? 'bg-white hover:bg-neutral-50' : 'bg-neutral-50 hover:bg-neutral-100'}
                  >
                    <td className="px-3 py-3 text-sm text-neutral-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: teamColors.success }}
                        />
                        <span className="font-medium text-neutral-900">{rating.team}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {getConferenceAbbreviation(rating.conference)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-900">
                      {rating.ranking}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-900">
                      <div className="flex items-center gap-3">
                        <span className="w-9 text-right">{rating.rating.toFixed(1)}</span>
                        <div className="flex-1 h-5 bg-neutral-200 rounded-sm overflow-hidden relative">
                          <div
                            className="h-full rounded-sm transition-all absolute"
                            style={{
                              width: `${overall.percent}%`,
                              backgroundColor: teamColors.success,
                              [overall.isNegative ? 'right' : 'left']: 0
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {rating.offense?.rating ? (
                        <div className="flex items-center gap-3">
                          <span className="w-9 text-right">{rating.offense.rating.toFixed(1)}</span>
                          <div className="flex-1 h-5 bg-neutral-200 rounded-sm overflow-hidden relative">
                            <div
                              className="h-full rounded-sm transition-all absolute"
                              style={{
                                width: `${offense.percent}%`,
                                backgroundColor: teamColors.success,
                                [offense.isNegative ? 'right' : 'left']: 0
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-right block">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {rating.defense?.rating ? (
                        <div className="flex items-center gap-3">
                          <span className="w-9 text-right">{rating.defense.rating.toFixed(1)}</span>
                          <div className="flex-1 h-5 bg-neutral-200 rounded-sm overflow-hidden relative">
                            <div
                              className="h-full rounded-sm transition-all absolute"
                              style={{
                                width: `${defense.percent}%`,
                                backgroundColor: teamColors.success,
                                [defense.isNegative ? 'right' : 'left']: 0
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-right block">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {rating.specialTeams?.rating ? (
                        <div className="flex items-center gap-3">
                          <span className="w-9 text-right">{rating.specialTeams.rating.toFixed(1)}</span>
                          <div className="flex-1 h-5 bg-neutral-200 rounded-sm overflow-hidden relative">
                            <div
                              className="h-full rounded-sm transition-all absolute"
                              style={{
                                width: `${specialTeams.percent}%`,
                                backgroundColor: teamColors.success,
                                [specialTeams.isNegative ? 'right' : 'left']: 0
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-right block">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Header - matching Games page */}
      <header className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start md:items-center sm:space-x-3">
              <div className="hidden sm:flex items-center justify-center w-15 h-15">
                <img
                  src={logo}
                  alt="Graphing College Football Logo"
                  className="h-14 w-14 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 mt-0.5 sm:mt-0">
                  Graphing College Football
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 mt-0">
                  Advanced play-by-play metrics<span className="hidden sm:inline"> and visualizations</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Games Button */}
              <a
                href="/"
                className="flex items-center justify-center sm:justify-start gap-2 px-3 h-10 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 transition-all duration-200 text-sm font-medium"
                title="Games"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="hidden sm:inline">Games</span>
              </a>

              {/* Info Button */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex items-center justify-center w-10 h-10 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-all duration-200"
                title="About this project"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters - matching Games page style */}
          <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow-sm sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="year-select" className="block text-sm font-medium text-neutral-700 mb-2">
                    Year
                  </label>
                  <select
                    id="year-select"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 appearance-none bg-[length:1.5em_1.5em] bg-[position:calc(100%-0.75rem)_center] bg-no-repeat"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")` }}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label htmlFor="conference-select" className="block text-sm font-medium text-neutral-700 mb-2">
                    Conference
                  </label>
                  <select
                    id="conference-select"
                    value={selectedConference}
                    onChange={(e) => setSelectedConference(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 appearance-none bg-[length:1.5em_1.5em] bg-[position:calc(100%-0.75rem)_center] bg-no-repeat"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")` }}
                  >
                    {conferences.map((conf) => (
                      <option key={conf} value={conf}>
                        {conf === 'all' ? 'All Conferences' : conf === 'power4' ? 'Power 4' : conf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedConference !== 'all' && (
                <div className="text-sm text-neutral-600">
                  Showing {sortedRatings.length} team{sortedRatings.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Page Header */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-neutral-900">
              SP+ Team Ratings
            </h3>
            <p className="text-neutral-600 mb-6">
              {year} Season
            </p>

            {/* Data Definitions and Notes Section - matching Games page */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-4">
              <button
                onClick={() => setShowDataDefinitions(!showDataDefinitions)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-5 w-5 text-neutral-600" />
                  <h2 className="text-xl font-semibold text-neutral-900">
                    <span className="hidden sm:inline">Data </span>Definitions and Notes
                  </h2>
                </div>
                <ChevronDown className={`h-6 w-6 text-neutral-500 transition-transform ${showDataDefinitions ? 'rotate-180' : ''}`} />
              </button>

              {showDataDefinitions && (
                <div className="mt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">What is SP+?</h4>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      SP+ (formerly known as S&P+) is a tempo- and opponent-adjusted rating system created by Bill Connelly.
                      It measures team efficiency on a per-play basis, adjusted for the strength of opponent and the pace at which games are played.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">How to Read the Ratings</h4>
                    <ul className="space-y-2 text-sm text-neutral-700">
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span><strong>Overall Rating:</strong> The combined offensive and defensive efficiency. Higher is better. A rating of 0.0 represents an average FBS team.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span><strong>Offensive Rating:</strong> Points above/below average a team's offense would score against an average defense. Higher is better.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span><strong>Defensive Rating:</strong> Points above/below average a team's defense would allow against an average offense. Higher is better (fewer points allowed).</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                    <p className="text-xs text-neutral-600">
                      <strong>Data Source:</strong> SP+ ratings provided by{' '}
                      <a
                        href="https://collegefootballdata.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-900 underline hover:text-neutral-700"
                      >
                        CollegeFootballData.com
                      </a>
                      . Created by Bill Connelly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-neutral-500">Loading SP+ ratings...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Top 25 Tables */}
          {!loading && !error && ratings.length > 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {renderTop25Table(
                  'Top 25 Overall SP+',
                  top25Overall,
                  'overall',
                  'SP+',
                  expandedTop25,
                  () => setExpandedTop25(!expandedTop25),
                  selectedConference !== 'all' && selectedConference !== 'power4'
                )}
                {renderTop25Table(
                  'Top 25 Offense',
                  top25Offense,
                  'offense',
                  'Off. SP+',
                  expandedTop25,
                  () => setExpandedTop25(!expandedTop25),
                  selectedConference !== 'all' && selectedConference !== 'power4'
                )}
                {renderTop25Table(
                  'Top 25 Defense',
                  top25Defense,
                  'defense',
                  'Def. SP+',
                  expandedTop25,
                  () => setExpandedTop25(!expandedTop25),
                  selectedConference !== 'all' && selectedConference !== 'power4'
                )}
              </div>

              {/* Main Comprehensive Table */}
              <div className="space-y-8">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-neutral-900">
                    All Teams - Detailed Rankings
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Complete sortable table with all rating categories
                  </p>
                </div>
                {renderMainTable()}
              </div>
            </>
          )}

          {/* No Data */}
          {!loading && !error && ratings.length === 0 && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-center">
              <p className="text-neutral-500">No ratings data available for {year}.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-lg font-medium text-neutral-900">About This Project</p>
              <p className="text-sm leading-relaxed max-w-3xl text-neutral-700">
                This tool is the culmination of 10+ years of work! I'm a <a href="https://medium.com/alex-couch-s-portfolio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">product designer</a> by day, and I write an advanced analytics column for <a href="https://rollbamaroll.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">RollBamaRoll.com</a>. I love data viz, and am a big fan of college football from growing up.
              </p>
            </div>

            <div>
              <p className="text-sm mb-5 text-neutral-700">
                If you find this useful, feel free to buy me a coffee to support continued development!
              </p>
              <div className="space-y-3">
                <a
                  href="https://buymeacoffee.com/alexcouch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  ☕ Support this project
                </a>
                <div>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Get in touch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* About This Project Modal */}
      {showInfoModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-neutral-900">About This Project</h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6 space-y-4">
              <p className="leading-relaxed text-neutral-700">
                This tool is the culmination of 10+ years of work! I'm a{' '}
                <a
                  href="https://medium.com/alex-couch-s-portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  product designer
                </a>
                {' '}by day, and I write an advanced analytics column for{' '}
                <a
                  href="https://rollbamaroll.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  RollBamaRoll.com
                </a>
                . I love data visualization, and am a big fan of college football from growing up.
              </p>

              <p className="text-neutral-700">
                If you find this useful, feel free to buy me a coffee to support continued development!
              </p>

              <div className="pt-2">
                <a
                  href="https://buymeacoffee.com/alexcouch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  ☕ Support this project
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <form onSubmit={handleContactFormSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-neutral-900">Get in Touch</h2>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={contactForm.name}
                      onChange={handleContactFormChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                      Your Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactFormChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-neutral-700 mb-2">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactFormChange}
                      required
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Enter your message"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {isSubmittingContact ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast
        message={toastMessage}
        type="success"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default RatingsPage;
