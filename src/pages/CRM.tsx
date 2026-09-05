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
      phone: form.phone ||
