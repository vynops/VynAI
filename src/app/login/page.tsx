import { Suspense } from 'react'
import LoginPage from './LoginPage'

export const metadata = {
  title: 'Sign in — VynAI',
}

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
