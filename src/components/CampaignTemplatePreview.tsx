import React, { useMemo } from 'react'

type TemplateComponent = {
  type?: string
  text?: string
  buttons?: Array<{ type?: string; text?: string; url?: string }>
}

type Template = {
  name: string
  language: string
  components?: unknown[]
}

export interface CampaignTemplatePreviewProps {
  template: Template | null
  values?: Record<number, string>
  fallbackText?: string
}

function renderText(text: string, values: Record<number, string>) {
  return text.replace(/\{\{(\d+)\}\}/g, (_, index) => values[Number(index)]?.trim() || `{{${index}}}`)
}

export default function CampaignTemplatePreview({
  template,
  values = {},
  fallbackText = '',
}: CampaignTemplatePreviewProps) {
  const parts = useMemo(() => {
    const components = Array.isArray(template?.components)
      ? template?.components as TemplateComponent[]
      : []

    const body = components.find(item => String(item?.type || '').toUpperCase() === 'BODY')
    const header = components.find(item => String(item?.type || '').toUpperCase() === 'HEADER')
    const footer = components.find(item => String(item?.type || '').toUpperCase() === 'FOOTER')
    const buttons = components.find(item => String(item?.type || '').toUpperCase() === 'BUTTONS')

    return {
      header: header?.text ? renderText(header.text, values) : '',
      body: body?.text ? renderText(body.text, values) : fallbackText,
      footer: footer?.text ? renderText(footer.text, values) : '',
      buttons: Array.isArray(buttons?.buttons) ? buttons.buttons : [],
    }
  }, [template, values, fallbackText])

  if (!template) {
    return (
      <div className="rounded-2xl border border-sand-200 bg-sand-50 p-5 text-sm text-ink-900/45">
        اختر قالب Marketing معتمد لمعاينة الرسالة.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-sand-200 bg-[#efeae2] p-4 sm:p-5">
      <div className="max-w-sm mx-auto rounded-2xl overflow-hidden shadow-sm border border-black/5 bg-[#e7ffdb]">
        <div className="px-4 py-3 bg-white border-b border-black/5">
          <div className="text-xs font-bold text-ink-950">{template.name}</div>
          <div className="text-[10px] text-ink-900/40 mt-0.5">{template.language}</div>
        </div>
        <div className="p-4">
          {parts.header && <div className="font-semibold text-sm text-ink-950 whitespace-pre-wrap">{parts.header}</div>}
          <div className="text-sm leading-6 text-ink-950 whitespace-pre-wrap mt-1">{parts.body}</div>
          {parts.footer && <div className="text-[11px] text-ink-900/45 mt-2 whitespace-pre-wrap">{parts.footer}</div>}
          {parts.buttons.length > 0 && (
            <div className="mt-3 space-y-2">
              {parts.buttons.map((button, index) => (
                <div key={`${button.text}-${index}`} className="rounded-xl bg-white/90 border border-black/5 text-center px-3 py-2 text-xs font-semibold text-blue-700">
                  {button.text || 'زر'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
