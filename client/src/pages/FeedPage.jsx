import { useState, useEffect, useRef } from 'react'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '../firebase'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from '../components/AvatarDisplay'

const EMOJIS = ['👍', '❤️', '😂', '😮', '🔥']

function timeAgo(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'à l\'instant'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}j`
}

export default function FeedPage() {
  const { player } = useApp()
  const [posts, setPosts] = useState([])
  const [reactions, setReactions] = useState({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const unsub = onValue(ref(db, 'feed'), (snap) => {
      const val = snap.val() || {}
      setPosts(Object.entries(val).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.createdAt - b.createdAt))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onValue(ref(db, 'feed_reactions'), (snap) => {
      setReactions(snap.val() || {})
    })
    return () => unsub()
  }, [])


  async function send(e) {
    e.preventDefault()
    if (!text.trim() || !player || sending) return
    setSending(true)
    await push(ref(db, 'feed'), {
      pseudoId: player.pseudoId,
      name: player.name,
      avatar: player.avatar,
      text: text.trim(),
      createdAt: Date.now(),
    })
    setText('')
    setSending(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function react(postId, emoji) {
    if (!player) return
    const path = `feed_reactions/${postId}/${player.pseudoId}`
    const current = reactions[postId]?.[player.pseudoId]
    await set(ref(db, path), current === emoji ? null : emoji)
  }

  return (
    <div className="page feed-page">
      <h1 className="page-title">Feed</h1>

      <div className="feed-messages">
        {posts.length === 0 && (
          <div className="feed-empty">
            <div className="icon">💬</div>
            <p>Aucun message — lance la discussion !</p>
          </div>
        )}
        {posts.map((p) => {
          const myReaction = reactions[p.id]?.[player?.pseudoId]
          const counts = {}
          Object.values(reactions[p.id] || {}).forEach((e) => { if (e) counts[e] = (counts[e] || 0) + 1 })
          const isMine = p.pseudoId === player?.pseudoId
          return (
            <div key={p.id} className={`feed-msg ${isMine ? 'feed-msg--mine' : ''}`}>
              <AvatarDisplay avatar={p.avatar} size={36} />
              <div className="feed-bubble">
                <div className="feed-header">
                  <span className="feed-name">{p.name}</span>
                  <span className="feed-time">{timeAgo(p.createdAt)}</span>
                </div>
                <div className="feed-text">{p.text}</div>
                <div className="feed-reactions">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      className={`feed-react-btn ${myReaction === e ? 'active' : ''}`}
                      onClick={() => react(p.id, e)}
                    >
                      {e}{counts[e] ? ` ${counts[e]}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {player && (
        <form className="feed-form" onSubmit={send}>
          <AvatarDisplay avatar={player.avatar} size={32} />
          <input
            className="feed-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Exprime-toi..."
            maxLength={500}
            disabled={sending}
          />
          <button className="feed-send" type="submit" disabled={!text.trim() || sending}>↑</button>
        </form>
      )}
    </div>
  )
}
