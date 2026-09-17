import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const ROOT_PATH = '/'

export default function BackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === ROOT_PATH) return null

  const handleBack = () => {
    const state = window.history.state
    const canGoBack = typeof state?.idx === 'number' ? state.idx > 0 : window.history.length > 1

    if (canGoBack) {
      navigate(-1)
      return
    }

    navigate(ROOT_PATH, { replace: true })
  }

  return (
    <div className="mb-4 flex justify-start">
      <button
        type="button"
        onClick={handleBack}
        aria-label="العودة للخلف"
        className="group inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-sm font-semibold text-sand-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sand-300 hover:bg-sand-50 hover:text-ink-950 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:ring-offset-2 active:translate-y-0"
      >
        <span aria-hidden="true" className="text-base leading-none transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        <span>العودة للخلف</span>
      </button>
    </div>
  )
}
