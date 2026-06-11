import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '../firebase'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'
import PlayerProfileModal from './PlayerProfileModal'

const EMOJIS = ['😊', '😂', '🔥', '❤️']

function timeAgo(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'à l\'instant'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}j`
}

export default function MatchChat({ matchId }) {
  const { player } = useApp()
  const [comments, setComments] = useState([])
  const [reactions, setReactions] = useState({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [profileId, setProfileId] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(null)
  const [pickerPos, setPickerPos] = useState(null)
  const messagesRef = useRef(null)

  useEffect(() => {
    const unsub = onValue(ref(db, `match_comments/${matchId}`), (snap) => {
      const val = snap.val() || {}
      setComments(Object.entries(val).map(([id, c]) => ({ id, ...c })).sort((a, b) => a.createdAt - b.createdAt))
    })
    return () => unsub()
  }, [matchId])

  useEffect(() => {
    const unsub = onValue(ref(db, `match_reactions/${matchId}`), (snap) => {
      setReactions(snap.val() || {})
    })
    return () => unsub()
  }, [matchId])

  useEffect(() => {
    if (!pickerOpen) return
    function handler(e) {
      if (!e.target.closest('.mc-react-wrap') && !e.target.closest('.mc-picker')) {
        setPickerOpen(null)
        setPickerPos(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  async function send(e) {
    e.preventDefault()
    if (!text.trim() || !player || sending) return
    setSending(true)
    try {
      await push(ref(db, `match_comments/${matchId}`), {
        pseudoId: player.pseudoId,
        name: player.name,
        avatar: player.avatar,
        text: text.trim(),
        createdAt: Date.now(),
      })
      setText('')
      setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }, 100)
    } catch (err) {
      console.error('[chat] send error:', err)
    } finally {
      setSending(false)
    }
  }

  async function react(commentId, emoji) {
    if (!player) return
    const path = `match_reactions/${matchId}/${commentId}/${player.pseudoId}`
    const current = reactions[commentId]?.[player.pseudoId]
    await set(ref(db, path), current === emoji ? null : emoji)
  }

  const currentComment = pickerOpen ? comments.find(c => c.id === pickerOpen) : null
  const currentMyReaction = currentComment ? reactions[currentComment.id]?.[player?.pseudoId] : null

  return (
    <div className="match-chat">
      {profileId && <PlayerProfileModal pseudoId={profileId} onClose={() => setProfileId(null)} />}
      {pickerOpen && pickerPos && createPortal(
        <div className="mc-picker" style={{ bottom: pickerPos.bottom, right: pickerPos.right }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`mc-picker-btn ${currentMyReaction === e ? 'active' : ''}`}
              onClick={() => { react(pickerOpen, e); setPickerOpen(null); setPickerPos(null) }}
            >
              {e}
            </button>
          ))}
        </div>,
        document.body
      )}
      <div className="match-chat-messages" ref={messagesRef}>
        {comments.length === 0 && (
          <div className="match-chat-empty">Aucun commentaire — soyez le premier !</div>
        )}
        {comments.map((c) => {
          const myReaction = reactions[c.id]?.[player?.pseudoId]
          const counts = {}
          Object.values(reactions[c.id] || {}).forEach((e) => { if (e) counts[e] = (counts[e] || 0) + 1 })
          const isMine = c.pseudoId === player?.pseudoId
          return (
            <div key={c.id} className={`mc-msg ${isMine ? 'mc-msg--mine' : ''}`}>
              <AvatarDisplay avatar={c.avatar} size={28} onClick={() => setProfileId(c.pseudoId)} />
              <div className="mc-bubble">
                <div className="mc-header">
                  <span className="mc-name">{c.name}</span>
                  <span className="mc-time">{timeAgo(c.createdAt)}</span>
                </div>
                <div className="mc-text">{c.text}</div>
                {Object.keys(counts).length > 0 && (
                  <div className="mc-chips">
                    {Object.entries(counts).map(([e, n]) => (
                      <button
                        key={e}
                        className={`mc-chip ${myReaction === e ? 'active' : ''}`}
                        onClick={() => react(c.id, e)}
                      >
                        {e} {n}
                      </button>
                    ))}
                  </div>
                )}
                <div className={`mc-react-wrap ${isMine ? 'mc-react-wrap--mine' : ''}`}>
                  <button
                    className="mc-react-trigger"
                    onClick={(ev) => {
                      if (pickerOpen === c.id) { setPickerOpen(null); setPickerPos(null); return }
                      const rect = ev.currentTarget.getBoundingClientRect()
                      setPickerPos({ bottom: window.innerHeight - rect.top + 6, right: window.innerWidth - rect.right })
                      setPickerOpen(c.id)
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {player && (
        <form className="mc-form" onSubmit={send}>
          <AvatarDisplay avatar={player.avatar} size={28} />
          <input
            className="mc-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Commentaire..."
            maxLength={300}
            disabled={sending}
          />
          <button className="mc-send" type="submit" disabled={!text.trim() || sending}>↑</button>
        </form>
      )}
    </div>
  )
}
