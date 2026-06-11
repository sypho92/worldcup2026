import { useState, useEffect, useRef, useCallback } from 'react'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '../firebase'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'

const EMOJIS = ['👍', '❤️', '😂', '😮', '🔥']

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

  return (
    <div className="match-chat">
      <div className="match-chat-messages" ref={messagesRef}>
        {comments.length === 0 && (
          <div className="match-chat-empty">Aucun commentaire — soyez le premier !</div>
        )}
        {comments.map((c) => {
          const myReaction = reactions[c.id]?.[player?.pseudoId]
          const counts = {}
          Object.values(reactions[c.id] || {}).forEach((e) => { if (e) counts[e] = (counts[e] || 0) + 1 })
          return (
            <div key={c.id} className={`mc-msg ${c.pseudoId === player?.pseudoId ? 'mc-msg--mine' : ''}`}>
              <AvatarDisplay avatar={c.avatar} size={28} />
              <div className="mc-bubble">
                <div className="mc-header">
                  <span className="mc-name">{c.name}</span>
                  <span className="mc-time">{timeAgo(c.createdAt)}</span>
                </div>
                <div className="mc-text">{c.text}</div>
                <div className="mc-reactions">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      className={`mc-react-btn ${myReaction === e ? 'active' : ''}`}
                      onClick={() => react(c.id, e)}
                    >
                      {e}{counts[e] ? ` ${counts[e]}` : ''}
                    </button>
                  ))}
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
