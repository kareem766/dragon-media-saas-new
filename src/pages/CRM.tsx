import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBLead {
  id: string
  name: string
  company: string | null
  phone: string | null
  source: string | null
  status: string
  created_at: string
}

interface DBCustomer {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  status: string
  total_spent: number
  tags: string[] | null
}

export default function CRM() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [tab, setTab] = useState<'leads' | 'customers'>('leads')
  const [leads, setLeads] = useState<DBLead[]>([])
  const [customers, setCustomers] = useState<DBCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', company: '', phone: '', source: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const [leadsRes, customersRes] = await Promise.all([
      supabase.from('leads').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ])
    if (leadsRes.data) setLeads(leadsRes.data as DBLead[])
    if (customersRes.data) setCustomers(customersRes.data as DBCustomer[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('leads').insert({
      organization_id: organizationId,
      name: form.name,
      company: form.company || null,
      phone: form.phone || null,
      source: form.source || null,
      status: 'جديد',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', company: '', phone: '', source: '' })
    setShowForm(false)
    loadData()
  }

  const handleConvert = async (lead: DBLead) => {
    if (!supabase || !organizationId) return
    setConvertingId(lead.id)
    const { error } = await supabase.from('customers').insert({
      organization_id: organizationId,
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      status: 'نشط',
      total_spent: 0,
    })
    if (!error) {
      await supabase.from('leads').delete().eq('id', lead.id)
    }
    setConvertingId(null)
    loadData()
    if (!error) setTab('customers')
  }

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-white border border-sand-200 rounded-xl p-1">
          
