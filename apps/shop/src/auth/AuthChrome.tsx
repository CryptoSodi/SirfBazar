import { Headset } from 'lucide-react'
import { Link } from 'react-router-dom'
import './auth-chrome.css'

export function AuthHeader({ mainId, onHelp }: { mainId: string; onHelp: () => void }) {
  return <>
    <a className="auth-skip" href={`#${mainId}`}>Skip to content</a>
    <header className="auth-header">
      <div className="auth-header-inner">
        <Link className="auth-logo" to="/sign-in" aria-label="SirfBazar sign in">
          <img src="/brand/sirfbazar-primary.svg" alt="SirfBazar" width="146" height="43" />
        </Link>
        <button className="auth-help" type="button" onClick={onHelp}>
          <Headset size={18} aria-hidden="true" />
          <span>Help</span>
        </button>
      </div>
    </header>
  </>
}

export function AuthFooter() {
  return <footer className="auth-footer"><p>© {new Date().getFullYear()} SirfBazar</p></footer>
}
