/**
 * Internal dependencies
 */
const { createReduxStore, register, select, dispatch, subscribe } = wp.data;
const { apiFetch } = wp;
const { addQueryArgs } = wp.url;
const { createRoot, useState, useMemo, useEffect, useRef } = wp.element;
const { __ } = wp.i18n;
const { nonceData, DOMPurify } = window;
const storeName = 'godam-video-engagement';

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
	/**
	 * Initialize the engagement store and subscribe to its state.
	 */
	init() {
		this.initStore();
	},

	/**
	 * Initializes the Redux store for video engagement, registers the store,
	 * sets up dispatch and select functions, subscribes to state changes, and
	 * exposes dispatch and select functions for testing purposes.
	 */
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

	/**
	 * Handles Redux actions for video engagement data.
	 *
	 * @param {Object} state  - The current state of engagement data.
	 * @param {Object} action - The Redux action to handle.
	 *
	 * @return {Object} The new state of engagement data.
	 */
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
						[ action.likeData.videoAttachmentId ]: state.likes[ action.likeData.videoAttachmentId ] + action.likeData.value,
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
		/**
		 * Dispatches an action to update the like status for a video.
		 *
		 * @async
		 * @param {string}      videoAttachmentId - The ID of the video attachment.
		 * @param {string}      siteUrl           - The URL of the site where the video is hosted.
		 * @param {Object}      storeObj          - The store object that handles video engagement data.
		 * @param {HTMLElement} likeLink          - The HTML element for the like button/link.
		 * @return {Object} An action object containing the type and like data.
		 */

		userHitiLke: async ( videoAttachmentId, siteUrl, storeObj, likeLink ) => {
			const likeStatus = storeObj.select.getIsUserLiked()[ videoAttachmentId ];
			const likeData = await storeObj.sendLikeData( videoAttachmentId, siteUrl, ! likeStatus );
			likeLink.disabled = false;
			likeLink.classList.remove( 'is-progressing' );
			return {
				type: ACTIONS.USER_HIT_LIKE,
				likeData,
			};
		},
		/**
		 * Dispatches an action to update the comment count for a video.
		 *
		 * @param {string} videoAttachmentId - The ID of the video attachment.
		 * @param {Array}  commentData       - The comment data returned by the API. This should be an array of comment objects.
		 * @return {Object} An action object containing the type, comment data, and video attachment ID.
		 */
		userCommented: ( videoAttachmentId, commentData ) => {
			return {
				type: ACTIONS.USER_COMMENTED,
				commentData,
				videoAttachmentId,
			};
		},

		/**
		 * Dispatches an action to load the default engagement data for videos.
		 *
		 * @async
		 * @param {Object} storeObj - The store object that handles video engagement data.
		 * @return {Object} An action object containing the type and new state.
		 */
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
		getIsUserLiked: ( state ) => state.IsUserLiked,
		getState: ( state ) => state,
		getComments: ( state ) => state.comments,
		getCommentsCount: ( state ) => state.commentsCount,
	},

	resolvers: {},

	/**
	 * Returns a Redux store with the specified reducer, actions, selectors, and resolvers.
	 *
	 * @return {Object} The Redux store.
	 */
	store() {
		return createReduxStore( 'godam-video-engagement', {
			reducer: this.reducer,
			actions: this.actions,
			selectors: this.selectors,
			resolvers: this.resolvers,
		} );
	},

	/**
	 * Watches the Redux state and triggers the distribution of engagement data when it changes.
	 *
	 * @return {void}
	 */
	watch() {
		const state = this.select.getState();
		this.distributeData( state );
	},

	/**
	 * Process the engagement data received from the server.
	 *
	 * @param {Array} collections An array of objects containing video attachment IDs and their respective engagement data.
	 *
	 * @return {Object} The processed engagement data.
	 */
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

	/**
	 * Distributes the engagement data to the respective video engagement elements.
	 *
	 * @param {Object} state The engagement state.
	 *
	 * @return {void}
	 */
	distributeData( state ) {
		const likes = state.likes;
		const views = state.views;
		const comments = state.commentsCount;
		const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );
		if ( 0 === videoIds.length ) {
			return null;
		}
		videoIds.forEach( ( item ) => {
			item.classList.remove( 'rtgodam-video-engagement--link-disabled' );
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

	/**
	 * Sends a request to the server to update the like status of a video.
	 *
	 * @param {number}  videoAttachmentId The ID of the video attachment.
	 * @param {string}  siteUrl           The URL of the site.
	 *
	 * @param {boolean} likeStatus        The current like status.
	 * @return {Promise} A promise that resolves to an object containing the video attachment ID and the response from the server.
	 */
	async sendLikeData( videoAttachmentId, siteUrl, likeStatus ) {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
			like_status: likeStatus,
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

	/**
	 * Fetches the engagement data for a video.
	 *
	 * @param {number} videoId           The ID of the video.
	 * @param {number} videoAttachmentId The ID of the video attachment.
	 * @param {string} siteUrl           The URL of the site.
	 *
	 * @return {Promise} A promise that resolves to an object containing the video attachment ID and the response from the server.
	 */
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

	/**
	 * Fetches the engagement data for all videos on the page.
	 *
	 * @return {Promise} A promise that resolves to an array of objects, each containing the video attachment ID and the response from the server.
	 */
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
					self.generateCommentModal( videoAttachmentId, siteUrl, videoId );
				} );
			}

			promises.push( self.fetchVideoData( videoId, videoAttachmentId, siteUrl ) );
		} );

		const results = await Promise.all( promises );
		collections.push( ...results );
		return collections;
	},

	/**
	 * Generates a modal for posting a comment on a video.
	 *
	 * @param {number} videoAttachmentId The video attachment ID.
	 * @param {string} siteUrl           The site URL.
	 * @param {string} videoId           The video attachment ID.
	 */
	generateCommentModal( videoAttachmentId, siteUrl, videoId ) {
		const modalId = 'rtgodam-video-engagement--comment-modal';
		let commentModal = document.getElementById( modalId );

		if ( commentModal ) {
			commentModal.remove();
		}
		commentModal = document.createElement( 'div' );
		commentModal.setAttribute( 'id', modalId );
		document.body.appendChild( commentModal );
		this.root = createRoot( commentModal );
		this.root.render( <CommentBox videoAttachmentId={ videoAttachmentId } siteUrl={ siteUrl } storeObj={ this } videoId={ videoId } /> );
	},
};

/**
 * Updates a comment tree with new data.
 *
 * @param {Array}  comments The comment tree.
 * @param {Object} comment  The comment object.
 * @param {Object} data     The new data to add to the comment tree.
 *
 * @return {Array} The updated comment tree.
 */
function updateCommentTree( comments, comment, data ) {
	if ( ! data.parent_id ) {
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

/**
 * CommentForm component for handling user comments and replies.
 *
 * This component renders a form for users to submit comments or replies
 * to a video. It manages the comment text input, handles the submission
 * process, and updates the comment tree state with the new comment data.
 *
 * Props:
 *
 * @param {Object}   props                   - The component props.
 * @param {Object}   props.comment           - The current comment object.
 * @param {Function} props.setCommentsData   - Function to update the comments data state.
 * @param {Object}   props.storeObj          - Store object for managing state and dispatching actions.
 * @param {string}   props.videoAttachmentId - The ID of the video attachment.
 * @param {Function} props.setIsExpanded     - Function to toggle the expanded state.
 * @param {string}   props.type              - The type of comment form, either 'reply' or 'thread-reply'.
 * @param {string}   props.siteUrl           - The site URL for API requests.
 *
 * @return {JSX.Element} A single comment component.
 */

function CommentForm( props ) {
	const { comment, setCommentsData, storeObj, videoAttachmentId, setIsExpanded, type, siteUrl } = props;
	const [ commentText, setCommentText ] = useState( '' );
	const [ isSending, setIsSending ] = useState( false );

	async function handleSubmit() {
		setIsSending( true );
		const parentId = comment.id ? comment.id : '';
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

/**
 * A single comment component.
 *
 * @param {Object}   props                   Component props.
 * @param {Object}   props.comment           Comment object.
 * @param {Function} props.setCommentsData   Function to update comments state.
 * @param {Object}   props.storeObj          A store object.
 * @param {number}   props.videoAttachmentId A video attachment ID.
 * @param {string}   props.siteUrl           A site URL.
 *
 * @return {JSX.Element} A single comment component.
 */
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
							{ authorName || __( 'Anonymous', 'godam' ) }
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
						<Comment key={ child.id } comment={ child } setCommentsData={ setCommentsData } storeObj={ storeObj } videoAttachmentId={ videoAttachmentId } siteUrl={ siteUrl } />
					) ) }
				</div>
			) }
		</div>
	);
}

/**
 * Renders a list of comments.
 *
 * @param {Object}   props                   Component props.
 * @param {number}   props.videoAttachmentId Video attachment ID.
 * @param {Object}   props.storeObj          Store object.
 * @param {Array}    props.commentsData      Array of comment objects.
 * @param {Function} props.setCommentsData   Function to set the commentsData state.
 * @param {string}   props.siteUrl           Site URL.
 *
 * @return {JSX.Element} A React element representing the comment list.
 */
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

/**
 * Renders a comment box modal.
 *
 * @param {Object} props                   Component props.
 * @param {number} props.videoAttachmentId Video attachment ID.
 * @param {Object} props.storeObj          Store object.
 * @param {string} props.siteUrl           Site URL.
 *
 * @return {JSX.Element} A React element representing the comment box modal.
 */
function CommentBox( props ) {
	const { videoAttachmentId, storeObj, siteUrl, videoId } = props;
	const baseClass = 'rtgodam-video-engagement--comment-modal';
	const commentsCount = storeObj.select.getCommentsCount()[ videoAttachmentId ] || 0;
	const comments = storeObj.select.getComments()[ videoAttachmentId ] || [];
	const [ commentsData, setCommentsData ] = useState( comments );
	const memoizedStoreObj = useMemo( () => storeObj, [ storeObj ] );
	const videoKey = videoId.replace( 'engagement-', '' );
	const videoContainerRef = useRef( null );
	const videoFigureId = `godam-player-container-${ videoKey }`;

	useEffect( () => {
		const currentVideoParent = document.getElementById( videoFigureId );
		const currentVideo = currentVideoParent.querySelector( '.godam-video-wrapper' );
		const currentVideoClass = currentVideoParent.className;
		const currentVideoStyles = currentVideoParent.getAttribute( 'style' );

		const videoContainer = videoContainerRef.current;
		videoContainer.className = currentVideoClass;
		videoContainer.style = currentVideoStyles;
		videoContainer.appendChild( currentVideo );
		document.body.classList.add( 'no-scroll' );

		return () => {
			currentVideoParent.insertBefore( currentVideo, currentVideoParent.firstChild );
			document.body.classList.remove( 'no-scroll' );
		};
	}, [ videoFigureId ] );

	return (
		<div className={ baseClass }>
			<button className={ `${ baseClass }--close-button` } onClick={ () => storeObj.root.unmount() }>&times;</button>
			<div className={ baseClass + '-content' }>
				<figure ref={ videoContainerRef }></figure>
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

/**
 * Initializes the video engagement store.
 *
 * This function should be called once to initialize the video engagement store.
 * It is called automatically on page load by the Godam plugin.
 */
export function engagement() {
	engagementStore.init();
}
