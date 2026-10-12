'use client'

import { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { Card, MetricCard } from '@/components/Card'
import { Button } from '@/components/ui/button'
import {
  Search,
  Download,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface RecognitionSession {
  id: string
  sentence: string
  confidence: number
  duration: number
  date: string
  gestures: number
}

const MOCK_SESSIONS: RecognitionSession[] = [
  { id: '1', sentence: 'Hello, how are you doing today?', confidence: 96.8, duration: 12.4, date: '2024-07-19', gestures: 8 },
  { id: '2', sentence: 'I love programming and coding', confidence: 94.2, duration: 10.8, date: '2024-07-19', gestures: 6 },
  { id: '3', sentence: 'What is your name please', confidence: 91.5, duration: 9.2, date: '2024-07-18', gestures: 5 },
  { id: '4', sentence: 'Thank you very much for helping', confidence: 93.7, duration: 11.1, date: '2024-07-18', gestures: 7 },
  { id: '5', sentence: 'This is an amazing application', confidence: 92.1, duration: 10.5, date: '2024-07-17', gestures: 6 },
]

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredSessions = MOCK_SESSIONS.filter((session) =>
    session.sentence.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage)

  const avgConfidence =
    MOCK_SESSIONS.reduce((acc, s) => acc + s.confidence, 0) / MOCK_SESSIONS.length

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full space-y-6">
        <div className="border-b border-border pb-6">
          <h1 className="text-2xl font-semibold text-foreground">Recognition History</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage all your translation sessions</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sentences..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full rounded-md border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Metric Cards */}
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Total Sessions" value={MOCK_SESSIONS.length} />
          <MetricCard label="Average Confidence" value={avgConfidence.toFixed(1)} unit="%" />
          <MetricCard
            label="Total Gestures Recognized"
            value={MOCK_SESSIONS.reduce((acc, s) => acc + s.gestures, 0)}
          />
        </div>

        {/* History Table */}
        <Card>
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Sessions</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left">Sentence</th>
                    <th className="px-4 py-2.5 text-right">Confidence</th>
                    <th className="px-4 py-2.5 text-right">Duration</th>
                    <th className="px-4 py-2.5 text-right">Gestures</th>
                    <th className="px-4 py-2.5 text-right">Date</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.length > 0 ? (
                    paginatedSessions.map((session) => (
                      <tr key={session.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">{session.sentence}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${session.confidence}%` }} />
                            </div>
                            <span className="font-medium text-foreground">{session.confidence.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{session.duration}s</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{session.gestures}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {new Date(session.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground">
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No sessions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
