// --- SOCIAL & COMMUNITY MODULE ---
let viewingUserUid = null; 
let activeChatId = null;
let feedUnsubscribe = null;

// Globale Funktionen für HTML-Onclick Events
window.refreshSocial = function() { if(!currentUser) return; loadFriendsFeed(); loadChatInbox(); };

window.switchSocialTab = function(tabName) { 
    document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active')); 
    // Event Target Workaround falls via JS aufgerufen
    if(event && event.target) event.target.classList.add('active');
    
    document.getElementById('tab-feed').style.display = 'none'; 
    document.getElementById('tab-friends').style.display = 'none'; 
    document.getElementById('tab-chats').style.display = 'none'; 
    
    if(tabName === 'feed') document.getElementById('tab-feed').style.display = 'block'; 
    else if(tabName === 'friends') { document.getElementById('tab-friends').style.display = 'block'; loadFriendsList(); } 
    else if(tabName === 'chats') { document.getElementById('tab-chats').style.display = 'block'; loadChatInbox(); } 
    else if(tabName === 'profile') if(currentUser) openProfile(currentUser.uid); 
};

window.initUserProfile = function() { 
    db_fire.collection('users').doc(currentUser.uid).onSnapshot(doc => { 
        if (!doc.exists) { 
            db_fire.collection('users').doc(currentUser.uid).set({ email: currentUser.email, username: currentUser.email.split('@')[0], bio: "DriverHub User", photoURL: "", followers: 0, following: 0, searchKey: currentUser.email.split('@')[0].toLowerCase(), joined: new Date() }, {merge:true}); 
        } else { 
            const data = doc.data(); 
            if(data.username) { currentUserName = data.username; if(window.updateTimeGreeting) window.updateTimeGreeting(); } 
            if(data.photoURL && app.comm.profileIcon) { 
                app.comm.profileIcon.style.backgroundImage = `url('${data.photoURL}')`; 
                app.comm.profileIcon.style.backgroundSize = 'cover'; 
                app.comm.profileIcon.classList.remove('fa-user-circle'); 
                app.comm.profileIcon.classList.remove('fa-solid'); 
            } 
        } 
    }); 
};

window.loadFriendsFeed = function() { 
    if(feedUnsubscribe) feedUnsubscribe(); 
    db_fire.collection('follows').where('followerId', '==', currentUser.uid).get().then(snap => { 
        const followingIds = []; 
        snap.forEach(doc => followingIds.push(doc.data().followingId)); 
        followingIds.push(currentUser.uid); 
        feedUnsubscribe = db_fire.collection('posts').orderBy('timestamp', 'desc').limit(50).onSnapshot(postSnap => { 
            const container = app.comm.feed; 
            const msg = document.getElementById('no-friends-msg'); 
            container.innerHTML = ""; 
            let hasPosts = false; 
            postSnap.forEach(doc => { 
                const post = doc.data(); 
                if(followingIds.includes(post.uid)) { renderPost(post, container, doc.id); hasPosts = true; } 
            }); 
            if(!hasPosts) { container.appendChild(msg); msg.style.display = 'block'; } else { msg.style.display = 'none'; } 
        }); 
    }); 
};

// Interne Helper
function renderPost(post, container, postId) { 
    const date = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "Now"; 
    let avaStyle = `background: var(--accent-blue);`; 
    let avaContent = post.author.charAt(0).toUpperCase(); 
    if(post.authorPic) { avaStyle = `background-image: url('${post.authorPic}');`; avaContent = ""; } 
    const likes = post.likes || []; 
    const isLiked = likes.includes(currentUser.uid); 
    const likeIconClass = isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart"; 
    const likeColorClass = isLiked ? "liked" : ""; 
    let deleteBtn = ""; 
    if(post.uid === currentUser.uid) { deleteBtn = `<button class="btn-delete-post" onclick="deletePost('${postId}')"><i class="fa-solid fa-trash"></i></button>`; } 
    const div = document.createElement('div'); div.className = 'post-card'; 
    div.innerHTML = `<div class="post-header" onclick="openProfile('${post.uid}')"><div class="post-avatar" style="${avaStyle}">${avaContent}</div><span class="post-user">${escapeHtml(post.author)}</span><span class="post-date">${date}</span></div>${deleteBtn}<div class="post-content">${escapeHtml(post.text)}</div><div class="post-actions"><span class="action-btn ${likeColorClass}" onclick="toggleLike('${postId}', ${isLiked})"><i class="${likeIconClass}"></i> ${likes.length} Like${likes.length !== 1 ? 's' : ''}</span></div>`; 
    container.appendChild(div); 
}

window.toggleLike = function(postId, currentlyLiked) { 
    const postRef = db_fire.collection('posts').doc(postId); 
    if (currentlyLiked) { postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) }); } 
    else { postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) }); } 
};

window.deletePost = function(postId) { if(confirm("Post löschen?")) { db_fire.collection('posts').doc(postId).delete(); } };

// Profile Logic
window.openProfile = function(uid) { 
    viewingUserUid = uid; 
    const isMe = (currentUser.uid === uid); 
    app.comm.mainView.style.display = 'none'; app.comm.profileView.style.display = 'block'; app.comm.chatView.style.display = 'none'; 
    document.getElementById('comm-title').innerText = isMe ? "Mein Profil" : "Profil"; 
    const pName = document.getElementById('p-name'); const pBio = document.getElementById('p-bio'); const pImg = document.getElementById('p-header-img'); const postList = document.getElementById('profile-posts-list'); 
    pName.innerText = "Lade..."; pBio.innerText = "..."; pImg.style.backgroundImage = "none"; postList.innerHTML = ""; 
    db_fire.collection('users').doc(uid).onSnapshot(doc => { 
        if(!doc.exists) return; const data = doc.data(); 
        pName.innerText = data.username; pBio.innerText = data.bio || "Keine Bio."; 
        if(data.photoURL) pImg.style.backgroundImage = `url('${data.photoURL}')`; 
        document.getElementById('p-followers').innerText = data.followers || 0; document.getElementById('p-following').innerText = data.following || 0; 
    }); 
    db_fire.collection('posts').where('uid', '==', uid).orderBy('timestamp', 'desc').limit(10).get().then(snap => { snap.forEach(doc => renderPost(doc.data(), postList, doc.id)); }); 
    if(isMe) { 
        document.getElementById('btn-edit-img').style.display = 'flex'; document.getElementById('btn-edit-bio').style.display = 'inline-block'; 
        document.getElementById('btn-follow-action').style.display = 'none'; document.getElementById('btn-msg-action').style.display = 'none'; 
    } else { 
        document.getElementById('btn-edit-img').style.display = 'none'; document.getElementById('btn-edit-bio').style.display = 'none'; 
        document.getElementById('btn-follow-action').style.display = 'inline-block'; document.getElementById('btn-msg-action').style.display = 'inline-block'; 
        checkIfFollowing(uid); 
    } 
};

document.getElementById('btn-back-feed').addEventListener('click', () => { 
    app.comm.profileView.style.display = 'none'; app.comm.mainView.style.display = 'block'; app.comm.chatView.style.display = 'none'; 
    document.getElementById('comm-title').innerText = "Community"; 
    window.switchSocialTab('feed');
});

// Post Creating
app.comm.postBtn.addEventListener('click', () => { 
    const txt = app.comm.postInput.value; if(!txt) return; if(txt.length > 300) { alert("Text zu lang!"); return; } 
    db_fire.collection('users').doc(currentUser.uid).get().then(doc => { 
        const uData = doc.data() || {}; 
        db_fire.collection('posts').add({ text: txt, uid: currentUser.uid, author: uData.username || "User", authorPic: uData.photoURL || "", likes: [], timestamp: firebase.firestore.FieldValue.serverTimestamp() }); 
        app.comm.postInput.value = ""; 
    }); 
});

// Follow Logic
function checkIfFollowing(uid) { db_fire.collection('follows').where('followerId', '==', currentUser.uid).where('followingId', '==', uid).onSnapshot(snap => updateFollowBtn(!snap.empty)); }
function updateFollowBtn(isFollowing) { const btn = document.getElementById('btn-follow-action'); if(isFollowing) { btn.innerText = "Folge ich"; btn.classList.add('following'); } else { btn.innerText = "Folgen"; btn.classList.remove('following'); } }
document.getElementById('btn-follow-action').addEventListener('click', () => { 
    if(!viewingUserUid) return; 
    const followRef = db_fire.collection('follows').where('followerId', '==', currentUser.uid).where('followingId', '==', viewingUserUid); 
    followRef.get().then(snap => { 
        if(snap.empty) { 
            db_fire.collection('follows').add({ followerId: currentUser.uid, followingId: viewingUserUid }); 
            db_fire.collection('users').doc(viewingUserUid).set({ followers: firebase.firestore.FieldValue.increment(1) }, {merge:true}); 
            db_fire.collection('users').doc(currentUser.uid).set({ following: firebase.firestore.FieldValue.increment(1) }, {merge:true}); 
            updateFollowBtn(true); 
        } else { 
            snap.forEach(doc => doc.ref.delete()); 
            db_fire.collection('users').doc(viewingUserUid).set({ followers: firebase.firestore.FieldValue.increment(-1) }, {merge:true}); 
            db_fire.collection('users').doc(currentUser.uid).set({ following: firebase.firestore.FieldValue.increment(-1) }, {merge:true}); 
            updateFollowBtn(false); 
        } 
    }); 
});

// Chat & Search
app.comm.search.addEventListener('input', (e) => { 
    const term = e.target.value.toLowerCase(); const resBox = app.comm.results; 
    if(term.length < 2) { resBox.style.display = 'none'; return; } 
    db_fire.collection('users').limit(20).get().then(snap => { 
        resBox.innerHTML = ""; let count = 0; 
        snap.forEach(doc => { 
            const u = doc.data(); 
            if(u.username && u.username.toLowerCase().includes(term) && doc.id !== currentUser.uid) { 
                count++; const d = document.createElement('div'); d.className = 'search-item'; 
                const img = u.photoURL ? `background-image:url('${u.photoURL}')` : `background:var(--accent-blue)`; 
                d.innerHTML = `<div class="s-avatar" style="${img}"></div><span>${escapeHtml(u.username)}</span>`; 
                d.onclick = () => { resBox.style.display = 'none'; app.comm.search.value = ""; openProfile(doc.id); }; 
                resBox.appendChild(d); 
            } 
        }); 
        resBox.style.display = (count > 0) ? 'block' : 'none'; 
    }); 
});

function loadFriendsList() { 
    const list = document.getElementById('friends-list-container'); list.innerHTML = "<p style='color:#666;text-align:center;'>Lade...</p>"; 
    db_fire.collection('follows').where('followerId', '==', currentUser.uid).get().then(snap => { 
        list.innerHTML = ""; 
        if(snap.empty) { list.innerHTML = "<p style='color:#666;text-align:center;'>Du folgst niemandem.</p>"; return; } 
        snap.forEach(fDoc => { 
            const fUid = fDoc.data().followingId; 
            db_fire.collection('users').doc(fUid).get().then(uDoc => { 
                const uData = uDoc.data(); 
                const d = document.createElement('div'); d.className = 'list-item-row'; 
                d.innerHTML = `<div class="s-avatar" style="${uData.photoURL ? `background-image:url('${uData.photoURL}')` : `background:var(--accent-blue)`}"></div><div class="list-info"><span class="list-name">${escapeHtml(uData.username)}</span><span class="list-sub">${escapeHtml(uData.bio || "")}</span></div>`; 
                d.onclick = () => openProfile(uDoc.id); list.appendChild(d); 
            }); 
        }); 
    }); 
}

function loadChatInbox() { 
    const list = document.getElementById('chats-list-container'); list.innerHTML = "<p style='color:#666;text-align:center;'>Lade...</p>"; 
    db_fire.collection('chats').where('participants', 'array-contains', currentUser.uid).onSnapshot(snap => { 
        list.innerHTML = ""; 
        if(snap.empty) { list.innerHTML = "<p style='color:#666;text-align:center;'>Keine Nachrichten vorhanden.</p>"; return; } 
        snap.forEach(doc => { 
            const chatData = doc.data(); const partnerUid = chatData.participants.find(uid => uid !== currentUser.uid); 
            db_fire.collection('users').doc(partnerUid).get().then(uDoc => { 
                const uData = uDoc.data() || {username: "Unknown"}; 
                const d = document.createElement('div'); d.className = 'list-item-row'; 
                d.innerHTML = `<div class="s-avatar" style="${uData.photoURL ? `background-image:url('${uData.photoURL}')` : `background:var(--accent-blue)`}"></div><div class="list-info"><span class="list-name">${escapeHtml(uData.username)}</span><span class="list-sub">Chat öffnen</span></div>`; 
                d.onclick = () => { viewingUserUid = partnerUid; startChat(partnerUid, uData.username); }; list.appendChild(d); 
            }); 
        }); 
    }); 
}

function startChat(partnerUid, partnerName) { 
    const ids = [currentUser.uid, partnerUid].sort(); activeChatId = ids.join("_"); 
    db_fire.collection('chats').doc(activeChatId).set({ participants: ids }, {merge:true}); 
    app.comm.profileView.style.display = 'none'; app.comm.mainView.style.display = 'none'; app.comm.chatView.style.display = 'block'; 
    document.getElementById('chat-partner-name').innerText = partnerName; loadMessages(); 
}

function loadMessages() { 
    const msgBox = document.getElementById('chat-messages'); msgBox.innerHTML = ""; 
    db_fire.collection('chats').doc(activeChatId).collection('messages').orderBy('timestamp').onSnapshot(snap => { 
        msgBox.innerHTML = ""; 
        snap.forEach(doc => { 
            const m = doc.data(); 
            const bubble = document.createElement('div'); bubble.className = `chat-bubble ${m.senderId === currentUser.uid ? 'me' : 'them'}`; 
            bubble.innerText = m.text; msgBox.appendChild(bubble); 
        }); 
        msgBox.scrollTop = msgBox.scrollHeight; 
    }); 
}

document.getElementById('chat-send').addEventListener('click', () => { 
    const input = document.getElementById('chat-input'); const txt = input.value; 
    if(!txt || !activeChatId) return; 
    db_fire.collection('chats').doc(activeChatId).collection('messages').add({ text: txt, senderId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); 
    input.value = ""; 
});
document.getElementById('btn-close-chat').addEventListener('click', () => { app.comm.chatView.style.display = 'none'; app.comm.mainView.style.display = 'block'; activeChatId = null; });
document.getElementById('btn-msg-action').addEventListener('click', () => startChat(viewingUserUid, document.getElementById('p-name').innerText));
document.getElementById('btn-edit-bio').addEventListener('click', () => { const newBio = prompt("Neue Bio:", document.getElementById('p-bio').innerText); if(newBio !== null) { db_fire.collection('users').doc(currentUser.uid).set({ bio: newBio }, { merge: true }); } });
document.getElementById('btn-edit-img').addEventListener('click', () => document.getElementById('profile-img-input').click());
document.getElementById('profile-img-input').addEventListener('change', function(e) { 
    const file = e.target.files[0]; if(!file) return; 
    const storageRef = storage.ref(`profiles/${currentUser.uid}`); const uploadTask = storageRef.put(file); 
    uploadTask.on('state_changed', () => {}, (err) => alert(err.message), () => { uploadTask.snapshot.ref.getDownloadURL().then((url) => { db_fire.collection('users').doc(currentUser.uid).set({ photoURL: url }, { merge: true }); }); }); 
});
