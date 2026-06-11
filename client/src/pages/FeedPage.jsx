import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '../firebase'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from '../components/AvatarDisplay'
import PlayerProfileModal from '../components/PlayerProfileModal'
import { resizeImageForChat } from '../utils/image'

const EMOJIS = ['😊', '😂', '🔥', '❤️']

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
  const [image, setImage] = useState(null)
  const [sending, setSending] = useState(false)
  const [profileId, setProfileId] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(null)
  const [pickerPos, setPickerPos] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    if (!pickerOpen) return
    function handler(e) {
      if (!e.target.closest('.feed-react-wrap') && !e.target.closest('.feed-picker')) {
        setPickerOpen(null)
        setPickerPos(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  async function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const b64 = await resizeImageForChat(file)
    setImage(b64)
  }

  async function send(e) {
    e.preventDefault()
    if ((!text.trim() && !image) || !player || sending) return
    setSending(true)
    try {
      const payload = {
        pseudoId: player.pseudoId,
        name: player.name,
        avatar: player.avatar,
        text: text.trim(),
        createdAt: Date.now(),
      }
      if (image) payload.image = image
      await push(ref(db, 'feed'), payload)
      setText('')
      setImage(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error('[feed] send error:', err)
    } finally {
      setSending(false)
    }
  }

  async function react(postId, emoji) {
    if (!player) return
    const path = `feed_reactions/${postId}/${player.pseudoId}`
    const current = reactions[postId]?.[player.pseudoId]
    await set(ref(db, path), current === emoji ? null : emoji)
  }

  const currentPost = pickerOpen ? posts.find(p => p.id === pickerOpen) : null
  const currentMyReaction = currentPost ? reactions[currentPost.id]?.[player?.pseudoId] : null

  return (
    <div className="page feed-page">
      {profileId && <PlayerProfileModal pseudoId={profileId} onClose={() => setProfileId(null)} />}
      {lightbox && createPortal(
        <div className="chat-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="chat-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>,
        document.body
      )}
      {pickerOpen && pickerPos && createPortal(
        <div className="feed-picker" style={{ bottom: pickerPos.bottom, right: pickerPos.right }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`feed-picker-btn ${currentMyReaction === e ? 'active' : ''}`}
              onClick={() => { react(pickerOpen, e); setPickerOpen(null); setPickerPos(null) }}
            >
              {e}
            </button>
          ))}
        </div>,
        document.body
      )}
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
              <AvatarDisplay avatar={p.avatar} size={36} onClick={() => setProfileId(p.pseudoId)} />
              <div className="feed-bubble">
                <div className="feed-header">
                  <span className="feed-name">{p.name}</span>
                  <span className="feed-time">{timeAgo(p.createdAt)}</span>
                </div>
                {p.text && <div className="feed-text">{p.text}</div>}
                {p.image && (
                  <img
                    className="feed-msg-image"
                    src={p.image}
                    alt=""
                    onClick={() => setLightbox(p.image)}
                  />
                )}
                {Object.keys(counts).length > 0 && (
                  <div className="feed-chips">
                    {Object.entries(counts).map(([e, n]) => (
                      <button
                        key={e}
                        className={`feed-chip ${myReaction === e ? 'active' : ''}`}
                        onClick={() => react(p.id, e)}
                      >
                        {e} {n}
                      </button>
                    ))}
                  </div>
                )}
                <div className={`feed-react-wrap ${isMine ? 'feed-react-wrap--mine' : ''}`}>
                  <button
                    className="feed-react-trigger"
                    onClick={(ev) => {
                      if (pickerOpen === p.id) { setPickerOpen(null); setPickerPos(null); return }
                      const rect = ev.currentTarget.getBoundingClientRect()
                      setPickerPos({ bottom: window.innerHeight - rect.top + 6, right: window.innerWidth - rect.right })
                      setPickerOpen(p.id)
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {player && (
        <div className="feed-form-wrap">
          {image && (
            <div className="chat-img-preview">
              <div className="chat-img-preview-inner">
                <img className="chat-img-preview-thumb" src={image} alt="" />
                <button
                  className="chat-img-preview-remove"
                  type="button"
                  onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                >✕</button>
              </div>
            </div>
          )}
          <form className="feed-form" onSubmit={send}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleImageFile(e.target.files[0])}
            />
            <button
              className="mc-attach-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >+</button>
            <AvatarDisplay avatar={player.avatar} size={32} />
            <input
              className="feed-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Exprime-toi..."
              maxLength={500}
              disabled={sending}
            />
            <button className="feed-send" type="submit" disabled={(!text.trim() && !image) || sending}>↑</button>
          </form>
        </div>
      )}
    </div>
  )
}
