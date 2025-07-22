/**
 * Internal dependencies
 */
const { createReduxStore, register, select, dispatch, subscribe } = wp.data;
const { apiFetch } = wp;
const { addQueryArgs } = wp.url;
const { createRoot, useState, useMemo } = wp.element;
const { __ } = wp.i18n;
const { nonceData, DOMPurify } = window;
const storeName = 'godam-video-engagement';

// Demo comments for testing.
const DEFAULT_STATE = {
	views: {},
	likes: {},
	IsUserLiked: {},
	comments: {},
	commentsCount: {},
};

const ACTIONS = {
	LOAD_VIDEO_ENGAGEMENT_DATA: 'LOAD_VIDEO_ENGAGEMENT_DATA',
	USER_HIT_LIKE: 'USER_HIT_LIKE',
	USER_COMMENTED: 'USER_COMMENTED',
};

const engagementStore = {
	init() {
		this.initStore();
	},

	initStore() {
		register( this.store() );
		this.unsubscribe = subscribe(
			this.watch.bind( this ),
			storeName,
		);
		this.dispatch = dispatch( storeName );
		this.select = select( storeName );

		this.dispatch.loadDefaultData( this );

		// For testing purposes
		window.gdm_dispatch = this.dispatch;
		window.gdm_select = this.select;
	},

	reducer( state = DEFAULT_STATE, action ) {
		switch ( action.type ) {
			case ACTIONS.LOAD_VIDEO_ENGAGEMENT_DATA:
				return {
					...state,
					...action.newState,
				};
			case ACTIONS.USER_HIT_LIKE:
				return {
					...state,
					likes: {
						...state.likes,
						[ action.likeData.videoAttachmentId ]: action.likeData.likes_count,
					},
					IsUserLiked: {
						...state.IsUserLiked,
						[ action.likeData.videoAttachmentId ]: action.likeData.isUserLiked,
					},
				};
			case ACTIONS.USER_CANCELED_LIKED:
				return {
					...state,
				};
			case ACTIONS.USER_COMMENTED:
				return {
					...state,
					comments: {
						...state.comments,
						[ action.videoAttachmentId ]: action.commentData,
					},
					commentsCount: {
						...state.commentsCount,
						[ action.videoAttachmentId ]: state.commentsCount[ action.videoAttachmentId ] + 1,
					},
				};
			default:
				return state;
		}
	},

	actions: {
		userHitiLke: async ( videoAttachmentId, siteUrl, storeObj, likeLink ) => {
			const likeData = await storeObj.sendLikeData( videoAttachmentId, siteUrl );
			likeLink.disabled = false;
			likeLink.classList.remove( 'is-progressing' );
			return {
				type: ACTIONS.USER_HIT_LIKE,
				likeData,
			};
		},
		userCommented: ( videoAttachmentId, commentData ) => {
			return {
				type: ACTIONS.USER_COMMENTED,
				commentData,
				videoAttachmentId,
			};
		},

		loadDefaultData: async ( storeObj ) => {
			const collections = await storeObj.getVideoEngagementData();
			const newState = storeObj.processEngagements( collections );
			return {
				type: ACTIONS.LOAD_VIDEO_ENGAGEMENT_DATA,
				newState,
			};
		},
	},

	selectors: {
		getState: ( state ) => state,
		getComments: ( state ) => state.comments,
		getCommentsCount: ( state ) => state.commentsCount,
	},

	resolvers: {},

	store() {
		return createReduxStore( 'godam-video-engagement', {
			reducer: this.reducer,
			actions: this.actions,
			selectors: this.selectors,
			resolvers: this.resolvers,
		} );
	},

	watch() {
		const state = this.select.getState();
		this.distributeData( state );
	},

	processEngagements( collections ) {
		const engagementLikesData = {};
		const engagementViewsData = {};
		const engagementIsUserLikedData = {};
		const engagementCommentsData = {};
		const engagementCommentsCountData = {};
		collections.forEach( ( item ) => {
			engagementLikesData[ item.videoAttachmentId ] = item.data.likes_count;
			engagementIsUserLikedData[ item.videoAttachmentId ] = item.data.is_liked;
			engagementViewsData[ item.videoAttachmentId ] = item.data.views_count;
			engagementCommentsData[ item.videoAttachmentId ] = item.data.comments;
			engagementCommentsCountData[ item.videoAttachmentId ] = item.data.comments_count;
		} );

		return {
			views: engagementViewsData,
			likes: engagementLikesData,
			IsUserLiked: engagementIsUserLikedData,
			comments: engagementCommentsData,
			commentsCount: engagementCommentsCountData,
		};
	},

	distributeData( state ) {
		const likes = state.likes;
		const views = state.views;
		const comments = state.commentsCount;
		const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );
		if ( 0 === videoIds.length ) {
			return null;
		}
		videoIds.forEach( ( item ) => {
			const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
			const likeLink = item.querySelector( '.rtgodam-video-engagement--like-link' );
			const likeCount = item.querySelector( '.rtgodam-video-engagement--like-count' );
			const viewCount = item.querySelector( '.rtgodam-video-engagement--view-count' );
			const commentsCount = item.querySelector( '.rtgodam-video-engagement--comment-count' );
			likeLink.classList.toggle( 'is-liked', state.IsUserLiked[ videoAttachmentId ] );
			likeCount.innerHTML = DOMPurify.sanitize( likes[ videoAttachmentId ] ) || 0;
			viewCount.innerHTML = DOMPurify.sanitize( views[ videoAttachmentId ] ) || 0;
			commentsCount.innerHTML = DOMPurify.sanitize( comments[ videoAttachmentId ] ) || 0;
		} );
	},

	async sendLikeData( videoAttachmentId, siteUrl ) {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
		};
		apiFetch.use( apiFetch.createNonceMiddleware( nonceData.nonce ) );
		return await apiFetch( {
			path: addQueryArgs( '/godam/v1/engagement/user-hit-like' ),
			method: 'POST',
			data: queryParams,
		} ).then( ( response ) => {
			return {
				videoAttachmentId,
				...response,
			};
		} );
	},

	async fetchVideoData( videoId, videoAttachmentId, siteUrl ) {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
		};
		return await apiFetch( { path: addQueryArgs( '/godam/v1/engagement/activities', queryParams ) } ).then( ( response ) => {
			return {
				videoAttachmentId,
				...response,
			};
		} );
	},

	async getVideoEngagementData() {
		const self = this;
		const collections = [];
		const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );

		if ( 0 === videoIds.length ) {
			return collections;
		}

		const promises = [];

		videoIds.forEach( ( item ) => {
			const videoId = item.getAttribute( 'data-engagement-id' );
			const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
			const siteUrl = item.getAttribute( 'data-engagement-site-url' );
			const likeLink = item.querySelector( '.rtgodam-video-engagement--like-link' );
			const commentLink = item.querySelector( '.rtgodam-video-engagement--comment-link' );

			if ( likeLink ) {
				likeLink.addEventListener( 'click', ( event ) => {
					event.preventDefault();
					likeLink.classList.add( 'is-progressing' );
					likeLink.disabled = true;
					self.dispatch.userHitiLke( videoAttachmentId, siteUrl, self, likeLink );
				} );
			}

			if ( commentLink ) {
				commentLink.addEventListener( 'click', ( event ) => {
					event.preventDefault();
					self.generateCommentModal( videoAttachmentId, siteUrl );
				} );
			}

			promises.push( self.fetchVideoData( videoId, videoAttachmentId, siteUrl ) );
		} );

		const results = await Promise.all( promises );
		collections.push( ...results );
		return collections;
	},

	generateCommentModal( videoAttachmentId, siteUrl ) {
		const modalId = 'rtgodam-video-engagement--comment-modal';
		let commentModal = document.getElementById( modalId );

		if ( commentModal ) {
			commentModal.remove();
		}
		commentModal = document.createElement( 'div' );
		commentModal.setAttribute( 'id', modalId );
		document.body.appendChild( commentModal );
		this.root = createRoot( commentModal );
		this.root.render( <CommentBox videoAttachmentId={ videoAttachmentId } siteUrl={ siteUrl } storeObj={ this } /> );
	},
};

function updateCommentTree( comments, comment, data ) {
	if ( 0 === parseInt( data.parent_id ) || ! data.parent_id ) {
		return [ data, ...comments ];
	}

	return comments.map( ( item ) => {
		if ( item.id === comment.id ) {
			return {
				...item,
				children: [
					...item.children,
					data,
				],
			};
		}

		if ( item.children.length > 0 ) {
			return {
				...item,
				children: updateCommentTree( item.children, comment, data ),
			};
		}

		return item;
	} );
}

function CommentForm( props ) {
	const { comment, setCommentsData, storeObj, videoAttachmentId, setIsExpanded, type, siteUrl } = props;
	const [ commentText, setCommentText ] = useState( '' );
	const [ isSending, setIsSending ] = useState( false );

	async function handleSubmit() {
		setIsSending( true );
		const parentId = comment.id ? comment.id : 0;
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
			comment_parent_id: parentId,
			comment_text: commentText,
		};
		apiFetch.use( apiFetch.createNonceMiddleware( nonceData.nonce ) );
		const result = await apiFetch( {
			path: addQueryArgs( '/godam/v1/engagement/user-comment' ),
			method: 'POST',
			data: queryParams,
		} );

		if ( 'success' === result.status ) {
			setCommentText( '' );
			setIsSending( false );
			if ( 'thread-reply' === type ) {
				setIsExpanded( false );
			}
			setCommentsData( ( prevComments ) => {
				const newCommentTree = updateCommentTree( prevComments, comment, result.data );
				storeObj.dispatch.userCommented( videoAttachmentId, newCommentTree );
				return [ ...newCommentTree ];
			} );
		}
	}

	return (
		<div className="rtgodam-video-engagement--comment-form">
			<div className="rtgodam-video-engagement--comment-form-textarea">
				<textarea
					name="comment"
					value={ commentText }
					onChange={ ( e ) => setCommentText( e.target.value ) }
				/>
			</div>
			<div className="rtgodam-video-engagement--comment-form-submit">
				<button className={ 'rtgodam-video-engagement--comment-button' + ( isSending ? ' is-comment-progressing' : '' ) } disabled={ isSending || ! commentText } onClick={ handleSubmit }>
					{ 'thread-reply' === type ? __( 'Reply', 'godam' ) : __( 'Comment', 'godam' ) }
				</button>
				{ 'thread-reply' === type &&
					<button className="rtgodam-video-engagement--comment-button" onClick={ () => setIsExpanded( false ) }>
						{ __( 'Cancel', 'godam' ) }
					</button>
				}
			</div>
		</div>
	);
}

function Comment( props ) {
	const { comment, setCommentsData, storeObj, videoAttachmentId, siteUrl } = props;
	const {
		text,
		author_name: authorName,
		author_image: authorImg,
		children,
	} = comment;
	const [ isExpanded, setIsExpanded ] = useState( false );

	return (
		<div className={ 'rtgodam-video-engagement--comment-parent ' + ( children && children.length > 0 ? 'has-children' : '' ) }>
			<div className="rtgodam-video-engagement--comment-details">
				<div className="rtgodam-video-engagement--comment-author">
					<img className="rtgodam-video-engagement--comment-author-image" src={ authorImg } alt={ authorName } />
				</div>
				<div className="rtgodam-video-engagement--comment-content-wrapper">
					<div className="rtgodam-video-engagement--comment-content">
						<div className="rtgodam-video-engagement--comment-author-name">
							{ authorName }
						</div>
						<div className="rtgodam-video-engagement--comment-text">
							{ text }
						</div>
					</div>
					<div className="rtgodam-video-engagement--comment-reply">
						{ ! isExpanded && (
							<button className="rtgodam-video-engagement--comment-button" onClick={ () => setIsExpanded( true ) }>
								{ __( 'Reply', 'godam' ) }
							</button>
						) }
					</div>
					{ isExpanded && (
						<div className="rtgodam-video-engagement--comment-form">
							<CommentForm { ...props } setIsExpanded={ setIsExpanded } type="thread-reply" siteUrl={ siteUrl } />
						</div>
					) }
				</div>
			</div>
			{ children && children.length > 0 && (
				<div className="rtgodam-video-engagement--comment-child">
					{ children.map( ( child ) => (
						<Comment key={ child.id } comment={ child } setCommentsData={ setCommentsData } storeObj={ storeObj } videoAttachmentId={ videoAttachmentId } />
					) ) }
				</div>
			) }
		</div>
	);
}

function CommentList( props ) {
	const { videoAttachmentId, storeObj, commentsData, setCommentsData, siteUrl } = props;

	return (
		<div className="rtgodam-video-engagement--comment-list">
			{ commentsData.map( ( comment ) => (
				<Comment key={ comment.id } comment={ comment } setCommentsData={ setCommentsData } storeObj={ storeObj } videoAttachmentId={ videoAttachmentId } siteUrl={ siteUrl } />
			) ) }
		</div>
	);
}

function CommentBox( props ) {
	const { videoAttachmentId, storeObj, siteUrl } = props;
	const baseClass = 'rtgodam-video-engagement--comment-modal';
	const commentsCount = storeObj.select.getCommentsCount()[ videoAttachmentId ] || 0;
	const comments = storeObj.select.getComments()[ videoAttachmentId ] || [];
	const [ commentsData, setCommentsData ] = useState( comments );

	const memoizedStoreObj = useMemo( () => storeObj, [ storeObj ] );

	return (
		<div className={ baseClass }>
			<button className={ `${ baseClass }--close-button` } onClick={ () => storeObj.root.unmount() }>&times;</button>
			<div className={ baseClass + '-content' }>
				<h3 className={ baseClass + '-title' }>{ __( 'All Comments', 'godam' ) } ({ commentsCount })</h3>
				<CommentList { ...props } commentsData={ commentsData } setCommentsData={ setCommentsData } />
				<div className={ baseClass + '-leave-comment' }>
					<h5 className={ baseClass + '-leave-comment-title' }>{ __( 'Leave a comment', 'godam' ) }</h5>
					<CommentForm setCommentsData={ setCommentsData } storeObj={ memoizedStoreObj } videoAttachmentId={ videoAttachmentId } comment={ {} } siteUrl={ siteUrl } type="reply" />
				</div>
			</div>
		</div>
	);
}

export function engagement() {
	engagementStore.init();
}
