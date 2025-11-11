'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { setSelectedGroup } from '@/store/groups/groupsSlice'
import Group from '@/components/elements/Group/Group'

export default function GroupByNamePage() {
  const params = useParams<{ group: string }>()
  const dispatch = useDispatch()

  useEffect(() => {
    const groupFromUrl = decodeURIComponent(params.group || '')
    if (groupFromUrl) {
      dispatch(setSelectedGroup(groupFromUrl))
    }
  }, [params.group, dispatch])

  return <Group />
}



