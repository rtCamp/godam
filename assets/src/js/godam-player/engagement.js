/**
 * Internal dependencies
 */
import { ACTIONS } from './utils/constants';
/**
 * External dependencies
 */
import EmojiPicker from 'emoji-picker-react';
const { createReduxStore, register, select, dispatch, subscribe } = wp.data;
const { apiFetch } = wp;
const { addQueryArgs } = wp.url;
const { createRoot, useState, useMemo, useEffect, useRef } = wp.element;
const { __ } = wp.i18n;
const { currentLoggedInUserData, loginUrl, registrationUrl, defaultAvatar, nonce } = window.godamData;
const storeName = 'godam-video-engagement';

const DEFAULT_STATE = {
	titles: {},
	views: {},
	likes: {},
	IsUserLiked: {},
	comments: {},
	commentsCount: {},
	videoMarkUp: {},
	userData: currentLoggedInUserData,
};

const engagementStore = {
	/**
	 * Initialize the engagement store and subscribe to its state.
	 */
	init() {
		if ( select( storeName ) ) {
			return dispatch( storeName ).loadDefaultData( this );
		}
		return this.initStore();
	},

	/**
	 * Initializes the Redux store for video engagement, registers the store,
	 * sets up dispatch and select functions, subscribes to state changes, and
	 * exposes dispatch and select functions for testing purposes.
	 *
	 * @return {Promise} A promise that resolves when the default engagement data is loaded.
	 */
	initStore() {
		register( this.store() );
		this.unsubscribe = subscribe(
			this.watch.bind( this ),
			storeName,
		);
		this.dispatch = dispatch( storeName );
		this.select = select( storeName );

		return this.dispatch.loadDefaultData( this );
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
					IsUserLiked: {
						...state.IsUserLiked,
						...action.newState.IsUserLiked,
					},
					likes: {
						...state.likes,
						...action.newState.likes,
					},
					views: {
						...state.views,
						...action.newState.views,
					},
					comments: {
						...state.comments,
						...action.newState.comments,
					},
					commentsCount: {
						...state.commentsCount,
						...action.newState.commentsCount,
					},
					titles: {
						...state.titles,
						...action.newState.titles,
					},
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
			case ACTIONS.USER_COMMENTED:
				let commentCounter = state.commentsCount[ action.videoAttachmentId ];
				if ( 'new' === action.activity ) {
					commentCounter = commentCounter + 1;
				}
				if ( 'hard-delete' === action.activity ) {
					commentCounter = commentCounter - 1;
				}
				return {
					...state,
					comments: {
						...state.comments,
						[ action.videoAttachmentId ]: action.commentData,
					},
					commentsCount: {
						...state.commentsCount,
						[ action.videoAttachmentId ]: commentCounter,
					},
				};
			case ACTIONS.UPDATE_USER_DATA:
				return {
					...state,
					userData: {
						...action.userData,
					},
				};
			case ACTIONS.ADD_VIDEO_MARKUP:
				return {
					...state,
					videoMarkUp: {
						...state.videoMarkUp,
						[ action.videoId ]: action.markUp,
					},
				};
			default:
				return state;
		}
	},

	actions: {
		/**
		 * Dispatches an action to like or unlike a video.
		 *
		 * @param {string} videoAttachmentId - The ID of the video attachment.
		 * @param {string} siteUrl           - The URL of the site where the video is hosted.
		 * @param {Object} storeObj          - The store object that handles video engagement data.
		 *
		 * @return {Object} An action object containing the type and like data.
		 */
		userHitLike: ( videoAttachmentId, siteUrl, storeObj ) => {
			const likeStatus = storeObj.select.getIsUserLiked()[ videoAttachmentId ];
			storeObj.sendLikeData( videoAttachmentId, siteUrl, ! likeStatus );
			const likeData = {
				videoAttachmentId,
				value: likeStatus ? -1 : 1,
				isUserLiked: ! likeStatus,
			};
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
		 * @param {string} activity          - The activity type (e.g., "new" or "edit").
		 *
		 * @return {Object} An action object containing the type, comment data, and video attachment ID.
		 */
		userCommented: ( videoAttachmentId, commentData, activity = 'new' ) => {
			return {
				type: ACTIONS.USER_COMMENTED,
				commentData,
				videoAttachmentId,
				activity,
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

		/**
		 * Dispatches an action to generate a comment modal.
		 *
		 * @param {string}  videoAttachmentId - The ID of the video attachment.
		 * @param {string}  siteUrl           - The URL of the site where the video is hosted.
		 * @param {string}  videoId           - The ID of the video.
		 * @param {boolean} skipEngagements   - Whether to skip engagements.
		 *
		 * @return {Object} An action object containing the type.
		 */
		initiateCommentModal: ( videoAttachmentId, siteUrl, videoId, skipEngagements = false ) => {
			engagementStore.generateCommentModal( videoAttachmentId, siteUrl, videoId, skipEngagements );
			return {
				type: ACTIONS.GENERATE_COMMENT_MODAL,
			};
		},

		/**
		 * Dispatches an action to update the user data.
		 *
		 * @param {Object} userData - The new user data.
		 *
		 * @return {Object} An action object containing the type and new user data.
		 */
		updateUserData: ( userData ) => {
			return {
				type: ACTIONS.UPDATE_USER_DATA,
				userData,
			};
		},

		/**
		 * Dispatches an action to handle an error that occurred while performing an
		 * engagement action (e.g. liking a video).
		 *
		 * @param {string} message - The error message.
		 *
		 * @return {Object} An action object containing the type and error message.
		 */
		errorHappened: ( message ) => {
			return {
				type: ACTIONS.ERROR,
				message,
			};
		},

		addVideoMarkUp: ( videoId, markUp ) => {
			return {
				type: ACTIONS.ADD_VIDEO_MARKUP,
				videoId,
				markUp,
			};
		},
	},

	selectors: {
		getIsUserLiked: ( state ) => state.IsUserLiked,
		getState: ( state ) => state,
		getComments: ( state ) => state.comments,
		getCommentsCount: ( state ) => state.commentsCount,
		getLikes: ( state ) => state.likes,
		getViews: ( state ) => state.views,
		getTitles: ( state ) => state.titles,
		getUserData: ( state ) => state.userData,
		getVideoMarkUp: ( state ) => state.videoMarkUp,
	},

	resolvers: {},

	/**
	 * Returns a Redux store with the specified reducer, actions, selectors, and resolvers.
	 *
	 * @return {Object} The Redux store.
	 */
	store() {
		return createReduxStore( storeName, {
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
		const engagementData = collections.reduce( ( acc, item ) => {
			const id = item.videoAttachmentId;
			const data = item.data;
			acc.titles[ id ] = item.videoTitle;
			acc.likes[ id ] = data.likes_count;
			acc.views[ id ] = data.views_count;
			acc.IsUserLiked[ id ] = data.is_liked;
			acc.comments[ id ] = data.comments;
			acc.commentsCount[ id ] = data.comments_count;

			return acc;
		}, {
			titles: {},
			likes: {},
			views: {},
			IsUserLiked: {},
			comments: {},
			commentsCount: {},
		} );

		return engagementData;
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
		if (
			0 === videoIds.length ||
			( 0 === Object.keys( likes ).length ||
			0 === Object.keys( views ).length ||
			0 === Object.keys( comments ).length )
		) {
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
			likeCount.textContent = parseInt( likes[ videoAttachmentId ] ) || 0;
			viewCount.textContent = parseInt( views[ videoAttachmentId ] ) || 0;
			commentsCount.textContent = parseInt( comments[ videoAttachmentId ] ) || 0;
		} );
	},

	/**
	 * Sends a request to the server to update the like status of a video.
	 *
	 * @param {number}  videoAttachmentId The ID of the video attachment.
	 * @param {string}  siteUrl           The URL of the site.
	 * @param {boolean} likeStatus        The current like status.
	 *
	 * @return {Promise} A promise that resolves to an object containing the video attachment ID and the response from the server.
	 */
	async sendLikeData( videoAttachmentId, siteUrl, likeStatus ) {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
			like_status: likeStatus,
		};
		apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );
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
	 * @param {string} videoTitle        The title of the video.
	 *
	 * @return {Promise} A promise that resolves to an object containing the video attachment ID and the response from the server.
	 */
	async fetchVideoData( videoId, videoAttachmentId, siteUrl, videoTitle ) {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
		};
		return await apiFetch( { path: addQueryArgs( '/godam/v1/engagement/activities', queryParams ) } ).then( ( response ) => {
			return {
				videoAttachmentId,
				videoTitle,
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
			if ( item.hasAttribute( 'data-engagement-bind' ) ) {
				return;
			}

			const videoId = item.getAttribute( 'data-engagement-id' );
			const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
			const siteUrl = item.getAttribute( 'data-engagement-site-url' );
			const videoTitle = item.getAttribute( 'data-engagement-video-title' );
			const likeLink = item.querySelector( '.rtgodam-video-engagement--like-link' );
			const commentLink = item.querySelector( '.rtgodam-video-engagement--comment-link' );

			if ( likeLink ) {
				likeLink.addEventListener( 'click', ( event ) => {
					event.preventDefault();
					const { type: userType } = self.select.getUserData();
					if ( 'non-user' === userType ) {
						self.generateCommentModal( videoAttachmentId, siteUrl, videoId );
						return;
					}

					likeLink.classList.add( 'is-progressing' );
					likeLink.disabled = true;
					self.dispatch.userHitLike( videoAttachmentId, siteUrl, self );
					setTimeout( () => {
						likeLink.classList.remove( 'is-progressing' );
						likeLink.disabled = false;
					}, 500 );
				} );
			}

			if ( commentLink ) {
				commentLink.addEventListener( 'click', ( event ) => {
					event.preventDefault();
					self.generateCommentModal( videoAttachmentId, siteUrl, videoId );
				} );
			}

			promises.push( self.fetchVideoData( videoId, videoAttachmentId, siteUrl, videoTitle ) );
			item.setAttribute( 'data-engagement-bind', 'true' );
		} );

		const results = await Promise.all( promises );
		collections.push( ...results );
		return collections;
	},

	/**
	 * Generates a modal for posting a comment on a video.
	 *
	 * @param {number}  videoAttachmentId The video attachment ID.
	 * @param {string}  siteUrl           The site URL.
	 * @param {string}  videoId           The video attachment ID.
	 * @param {boolean} skipEngagements   Whether to skip engagements.
	 */
	generateCommentModal( videoAttachmentId, siteUrl, videoId, skipEngagements = false ) {
		const modalId = 'rtgodam-video-engagement--comment-modal';
		let commentModal = document.getElementById( modalId );

		if ( commentModal ) {
			commentModal.remove();
		}
		commentModal = document.createElement( 'div' );
		commentModal.setAttribute( 'id', modalId );
		document.body.appendChild( commentModal );
		this.root = createRoot( commentModal );
		this.root.render( <CommentBox videoAttachmentId={ videoAttachmentId } siteUrl={ siteUrl } storeObj={ this } videoId={ videoId } skipEngagements={ skipEngagements } /> );
	},
};

/**
 * Updates a comment tree with new data.
 *
 * @param {Array}  comments    The comment tree.
 * @param {Object} comment     The comment object.
 * @param {Object} data        The new data to add to the comment tree.
 * @param {string} commentType The type of comment action (new, edit, soft-delete, hard-delete).
 *
 * @return {Array} The updated comment tree.
 */
function updateCommentTree( comments, comment, data, commentType ) {
	if ( ! data.parent_id && 'new' === commentType ) {
		return [ data, ...comments ];
	}

	const commentTree = comments.map( ( item ) => {
		if ( item.id === comment.id && 'new' === commentType ) {
			return {
				...item,
				children: [
					...item.children,
					data,
				],
			};
		}

		if ( item.id === comment.id && ( 'edit' === commentType || 'soft-delete' === commentType ) ) {
			return {
				...item,
				text: data.text,
			};
		}

		if ( item.id === comment.id && 'hard-delete' === commentType ) {
			return null;
		}

		if ( item.children.length > 0 ) {
			return {
				...item,
				children: updateCommentTree( item.children, comment, data, commentType ),
			};
		}

		return item;
	} );

	if ( 'hard-delete' === commentType ) {
		return commentTree.filter( ( item ) => item !== null );
	}
	return commentTree;
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
	const { comment, setCommentsData, storeObj, videoAttachmentId, setIsExpanded, type, siteUrl, commentType, videoContainerRef } = props;
	const [ commentText, setCommentText ] = useState( () => {
		return 'edit' === commentType ? comment.text : '';
	} );
	const [ isSending, setIsSending ] = useState( false );
	const [ showEmojiPicker, setShowEmojiPicker ] = useState( false );
	const textareaRef = useRef( null );

	async function handleSubmit() {
		const text = commentText.trim();
		if ( 0 === text.length ) {
			return;
		}
		setIsSending( true );
		const parentId = comment.id ? comment.id : '';
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
			comment_parent_id: parentId,
			comment_text: text,
			comment_type: commentType,
		};
		apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );
		const result = await apiFetch( {
			path: addQueryArgs( '/godam/v1/engagement/user-comment' ),
			method: 'POST',
			data: queryParams,
		} );

		if ( 'error' === result.status ) {
			setIsSending( false );
			storeObj.dispatch.errorHappened( result.message );
			return;
		}

		setCommentText( '' );
		setIsSending( false );
		if ( 'thread-reply' === type ) {
			setIsExpanded( false );
		}
		setCommentsData( ( prevComments ) => {
			const newCommentTree = updateCommentTree( prevComments, comment, result.data, commentType );
			storeObj.dispatch.userCommented( videoAttachmentId, newCommentTree, commentType );
			return [ ...newCommentTree ];
		} );
	}

	/**
	 * Puts content at the current position of a textarea.
	 *
	 * @param {string} content The content to be inserted.
	 *
	 * @return {string} The new value of the textarea.
	 */
	function putContentToCursor( content ) {
		const ta = textareaRef.current;
		const start = ta.selectionStart;
		const end = ta.selectionEnd;
		const value = ta.value;
		return value.substring( 0, start ) + content + value.substring( end );
	}

	/**
	 * Grabs the current video timestamp and inserts it into the comment text field.
	 *
	 * It formats the timestamp as `@HH:MM:SS` and inserts it at the current cursor
	 * position in the comment text field.
	 */
	function handleTimestamp() {
		const videoPlayer = videoContainerRef.current.querySelector( 'video' );
		if ( videoPlayer ) {
			const currentTime = videoPlayer.currentTime;
			const hrs = String( Math.floor( currentTime / 3600 ) ).padStart( 2, '0' );
			const mins = String( Math.floor( ( currentTime % 3600 ) / 60 ) ).padStart( 2, '0' );
			const secs = String( Math.floor( currentTime % 60 ) ).padStart( 2, '0' );
			const timestamp = `@${ hrs }:${ mins }:${ secs }`;
			const newValue = putContentToCursor( timestamp );
			setCommentText( newValue );
		}
	}

	/**
	 * Inserts an emoji into the comment text field.
	 *
	 * @param {Object} emojiObject The object containing the emoji.
	 *
	 * @return {void}
	 */
	function handleEmoji( emojiObject ) {
		const emoji = emojiObject.emoji;
		const newValue = putContentToCursor( emoji );
		setCommentText( newValue );
		setShowEmojiPicker( false );
	}

	return (
		<div className="rtgodam-video-engagement--comment-form">
			{
				showEmojiPicker && (
					<div className="rtgodam-video-engagement--comment-form-emoji-picker">
						<EmojiPicker
							onEmojiClick={ ( emojiObject ) => {
								handleEmoji( emojiObject );
							} }
						/>
					</div>
				)
			}
			<div className="rtgodam-video-engagement--comment-form-textarea">
				<textarea
					name="comment"
					value={ commentText }
					onChange={ ( e ) => setCommentText( e.target.value ) }
					onKeyDown={ ( e ) => {
						if ( 'Enter' === e.key && ! e.shiftKey ) {
							e.preventDefault();
							handleSubmit();
						}
					} }
					disabled={ isSending }
					ref={ textareaRef }
				/>
				<button
					className="rtgodam-video-engagement--comment-button-timestamp"
					onClick={ handleTimestamp }
				>
					{ __( 'Add timestamp', 'godam' ) }
				</button>
				<button
					className="rtgodam-video-engagement--comment-button-emoji"
					onClick={ () => setShowEmojiPicker( ! showEmojiPicker ) }
				>
					{ __( 'Add emoji', 'godam' ) }
				</button>
				<button
					className={ 'rtgodam-video-engagement--comment-button' +
					( isSending ? ' is-comment-progressing' : '' ) }
					disabled={ isSending || 0 === commentText.trim().length }
					onClick={ handleSubmit }
				>
					{ 'thread-reply' === type ? __( 'Reply', 'godam' ) : __( 'Comment', 'godam' ) }
				</button>
			</div>
			{ 'thread-reply' === type &&
				<button className="rtgodam-video-engagement--comment-button button-general" onClick={ () => setIsExpanded( false ) }>
					{ __( 'Cancel', 'godam' ) }
				</button>
			}
		</div>
	);
}

/**
 * Converts time in HH:MM:SS format to seconds.
 *
 * @param {string|number} [h] - Hours.
 * @param {string|number} [m] - Minutes.
 * @param {string|number} [s] - Seconds.
 *
 * @return {number} Time in seconds.
 */
function timeToSeconds( h, m, s ) {
	const hh = Number( h ?? 0 );
	const mm = Number( m ?? 0 );
	const ss = Number( s ?? 0 );
	return ( hh * 3600 ) + ( mm * 60 ) + ss;
}

/**
 * Component to render a text with @HH:MM:SS or @MM:SS timestamps linked to video positions.
 *
 * @param {Object}                   props          - Component props.
 * @param {string}                   props.text     - Text to render.
 * @param {function(number, string)} [props.onJump] - Callback to handle clicking a timestamp.
 */
function TimeLinkedText( { text, onJump } ) {
	// Matches @HH:MM:SS or @MM:SS
	const re = /@(?:(\d{1,2}):)?(\d{2}):(\d{2})/g;

	const nodes = [];
	let lastIndex = 0;
	let match;

	while ( ( match = re.exec( text ) ) !== null ) {
		const [ raw, h, m, s ] = match;
		const start = match.index;

		// Push preceding plain text
		if ( start > lastIndex ) {
			nodes.push( text.slice( lastIndex, start ) );
		}

		const secs = timeToSeconds( h, m, s );

		nodes.push(
			<button
				key={ `${ start }-${ raw }` }
				type="button"
				onClick={ () => onJump?.( secs, raw ) }
				className="rtgodam-video-engagement--comment-go-to-timestamp"
			>
				{ raw }
			</button>,
		);

		lastIndex = start + raw.length;
	}

	// Push any trailing text
	if ( lastIndex < text.length ) {
		nodes.push( text.slice( lastIndex ) );
	}

	return <>{ nodes }</>;
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
	const { comment, setCommentsData, storeObj, videoAttachmentId, siteUrl, isUserLoggedIn, videoContainerRef } = props;
	const {
		text,
		author_name: authorName,
		author_image: authorImg,
		author_email: authorEmail,
		created_at_date: createdAtDate,
		created_at_time: createdAtTime,
		children,
	} = comment;
	const [ isExpanded, setIsExpanded ] = useState( false );
	const [ commentType, setCommentType ] = useState( 'new' );
	const [ showChildComments, setShowChildComments ] = useState( false );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const {
		email: userEmail,
		type: userType,
	} = storeObj.select.getUserData();
	const isDeletedComment = '--soft-deleted-content--' === text.trim();

	async function handleDelete() {
		setIsDeleting( true );
		const commentId = comment.id ? comment.id : '';
		const deleteType = comment.children && comment.children.length > 0 ? 'soft-delete' : 'hard-delete';
		const queryParams = {
			video_id: videoAttachmentId,
			comment_id: commentId,
			delete_type: deleteType,
		};
		apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );
		const result = await apiFetch( {
			path: addQueryArgs( '/godam/v1/engagement/user-delete-comment' ),
			method: 'POST',
			data: queryParams,
		} );

		if ( 'error' === result.status ) {
			storeObj.dispatch.errorHappened( result.message );
			return;
		}

		setCommentsData( ( prevComments ) => {
			const newCommentTree = updateCommentTree(
				prevComments,
				comment,
				result.data,
				deleteType,
			);
			storeObj.dispatch.userCommented( videoAttachmentId, newCommentTree, deleteType );
			return [ ...newCommentTree ];
		} );
		setIsDeleting( false );
	}

	const handleJump = ( seconds ) => {
		const videoPlayer = videoContainerRef.current.querySelector( 'video' );
		if ( ! videoPlayer ) {
			return;
		}
		videoPlayer.currentTime = seconds;
	};

	return (
		<div className={ 'rtgodam-video-engagement--comment-parent ' + ( children && children.length > 0 ? 'has-children' : '' ) }>
			<div className="rtgodam-video-engagement--comment-details">
				<div className="rtgodam-video-engagement--comment-author">
					<img
						width={ 28 }
						height={ 28 }
						className="rtgodam-video-engagement--comment-author-image"
						src={ isDeletedComment ? defaultAvatar : authorImg }
						alt={ isDeletedComment ? __( 'Anonymous', 'godam' ) : authorName }
					/>
				</div>
				<div className="rtgodam-video-engagement--comment-content-wrapper">
					<div className="rtgodam-video-engagement--comment-content">
						<div className="rtgodam-video-engagement--comment-author">
							<div className="rtgodam-video-engagement--comment-author-name">
								{ isDeletedComment ? __( 'Anonymous', 'godam' ) : authorName || __( 'Anonymous', 'godam' ) }
							</div>
							<span className="rtgodam-video-engagement--comment-time">{ createdAtTime }</span>
							<span className="rtgodam-video-engagement--comment-date">{ createdAtDate }</span>
						</div>
						<div
							className={ 'rtgodam-video-engagement--comment-text' + ( isDeletedComment ? ' deleted-text' : '' ) }
						>
							<TimeLinkedText
								text={ isDeletedComment ? __( 'This comment has been deleted', 'godam' ) : text }
								onJump={ handleJump }
							/>
						</div>
					</div>
					{ ( ! isExpanded && isUserLoggedIn ) && (
						<div className="rtgodam-video-engagement--comment-action">
							<button
								className="rtgodam-video-engagement--comment-button comment-button-reply" onClick={ () => {
									setIsExpanded( true );
									setCommentType( 'new' );
								} }
							>
								{ __( 'Reply', 'godam' ) }
							</button>
							{
								userType === 'user' && userEmail === authorEmail && ! isDeletedComment && (
									<>
										<button
											className={ 'rtgodam-video-engagement--comment-button comment-button-delete' + ( isDeleting ? ' is-deleting' : '' ) }
											onClick={ handleDelete }
											disabled={ isDeleting }
										>
											{ __( 'Delete', 'godam' ) }
										</button>
										<button
											className="rtgodam-video-engagement--comment-button comment-button-edit" onClick={ () => {
												setIsExpanded( true );
												setCommentType( 'edit' );
											} }
										>
											{ __( 'Edit', 'godam' ) }
										</button>
									</>
								)
							}

						</div>
					) }
					{ isExpanded && (
						<div className="rtgodam-video-engagement--comment-form">
							<CommentForm { ...props } setIsExpanded={ setIsExpanded } type="thread-reply" siteUrl={ siteUrl } commentType={ commentType } videoContainerRef={ videoContainerRef } />
						</div>
					) }
				</div>
			</div>

			{ children && children.length > 0 && ! showChildComments && (
				<button
					className="rtgodam-video-engagement--comment-child-number"
					onClick={ () => setShowChildComments( true ) }
				>
					{
						children.length > 1 ? children.length + ' ' + __( 'Replies', 'godam' ) : children.length + ' ' + __( 'Reply', 'godam' )
					}
				</button>
			) }
			{ children && children.length > 0 && showChildComments && (
				<div className="rtgodam-video-engagement--comment-child">
					{ children.map( ( child ) => (
						<Comment
							key={ child.id }
							comment={ child }
							setCommentsData={ setCommentsData }
							storeObj={ storeObj }
							videoAttachmentId={ videoAttachmentId }
							siteUrl={ siteUrl }
							isUserLoggedIn={ isUserLoggedIn }
							videoContainerRef={ videoContainerRef }
						/>
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
	const {
		videoAttachmentId,
		storeObj,
		commentsData,
		setCommentsData,
		siteUrl,
		isUserLoggedIn,
		videoContainerRef,
	} = props;

	return (
		<div className="rtgodam-video-engagement--comment-list">
			{
				commentsData.length === 0 && (
					<div className="rtgodam-video-engagement--comment-empty">
						{ __( 'No comments yet. Be the first to comment!', 'godam' ) }
					</div>
				)
			}
			{ commentsData.map( ( comment ) => (
				<Comment
					key={ comment.id }
					comment={ comment }
					setCommentsData={ setCommentsData }
					storeObj={ storeObj }
					videoAttachmentId={ videoAttachmentId }
					siteUrl={ siteUrl }
					isUserLoggedIn={ isUserLoggedIn }
					videoContainerRef={ videoContainerRef }
				/>
			) ) }
		</div>
	);
}

function GuestLoginForm( props ) {
	const {
		baseClass,
		setIsUserLoggedIn,
		storeObj,
	} = props;
	const enableGuestLogin = false; // Enable guest login as a feature we may introduce in future.
	const [ showGuestForm, setShowGuestForm ] = useState( false );
	const [ guestEmail, setGuestEmail ] = useState( '' );
	const [ loginProgress, setLoginProgress ] = useState( false );

	async function handleGuestLogin() {
		if ( showGuestForm ) {
			setLoginProgress( true );
			const queryParams = {
				guest_user_email: guestEmail,
			};
			apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );
			const result = await apiFetch( {
				path: addQueryArgs( '/godam/v1/engagement/guest-user-login' ),
				method: 'POST',
				data: queryParams,
			} );

			if ( 'success' === result.status ) {
				setShowGuestForm( false );
				setIsUserLoggedIn( true );
				setGuestEmail( '' );
				setLoginProgress( false );
				storeObj.dispatch.updateUserData( result.data );
			}
		} else {
			setShowGuestForm( true );
		}
	}

	return (
		<div className={ baseClass + '-leave-comment-login-wrapper' }>
			{
				! showGuestForm && (
					<div className={ baseClass + '-leave-comment-login' }>
						<a href={ registrationUrl }>{ __( 'Register', 'godam' ) }</a> / <a href={ loginUrl }>{ __( 'Login', 'godam' ) }</a> { __( 'to comment', 'godam' ) }
					</div>
				)
			}
			{
				showGuestForm && (
					<div className={ baseClass + '-leave-comment-login-guest-form' }>
						<label htmlFor={ baseClass + '-leave-comment-login-guest-email' }>{ __( 'Email', 'godam' ) }</label>
						<input
							type="email"
							id={ baseClass + '-leave-comment-login-guest-email' }
							placeholder={ __( 'Enter your email', 'godam' ) }
							className={ loginProgress ? ' is-progressing' : '' }
							value={ guestEmail }
							onChange={ ( e ) => setGuestEmail( e.target.value ) } />
					</div>
				)
			}
			{
				enableGuestLogin && (
					<div className={ baseClass + '-leave-comment-login-guest-button' }>
						{
							showGuestForm && (
								<button onClick={ () => setShowGuestForm( ! showGuestForm ) }>
									{ __( 'Back', 'godam' ) }
								</button>
							)
						}

						<button
							className={ loginProgress ? ' is-progressing' : '' }
							onClick={ handleGuestLogin }
						>
							{
								showGuestForm ? __( 'Save', 'godam' ) : __( 'Continue as Guest', 'godam' )
							}
						</button>
					</div>
				)
			}
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
	const { videoAttachmentId, storeObj, siteUrl, videoId, skipEngagements } = props;
	const baseClass = 'rtgodam-video-engagement--comment-modal';
	const memoizedStoreObj = useMemo( () => storeObj, [ storeObj ] );
	const commentsCount = memoizedStoreObj.select.getCommentsCount()[ videoAttachmentId ] || 0;
	const likesCount = memoizedStoreObj.select.getLikes()[ videoAttachmentId ] || 0;
	const viewsCount = memoizedStoreObj.select.getViews()[ videoAttachmentId ] || 0;
	const isUserLiked = memoizedStoreObj.select.getIsUserLiked()[ videoAttachmentId ] || false;
	const titles = memoizedStoreObj.select.getTitles()[ videoAttachmentId ] || __( 'GoDAM Video', 'godam' );
	const comments = memoizedStoreObj.select.getComments()[ videoAttachmentId ] || [];
	const [ commentsData, setCommentsData ] = useState( comments );
	const videoKey = videoId.replace( 'engagement-', '' );
	const videoContainerRef = useRef( null );
	const videoFigureId = `godam-player-container-${ videoKey }`;
	const [ isSending, setIsSending ] = useState( false );
	const [ expendComment, setExpendComment ] = useState( false );
	const getUserData = memoizedStoreObj.select.getUserData();
	const loginStatus = 'guest' === getUserData?.type || 'user' === getUserData?.type;
	const [ isUserLoggedIn, setIsUserLoggedIn ] = useState( loginStatus );
	const videoRatioClass = 'rtgodam-video-engagement-dynamic-ratio-9-16';
	const videoInfoForMobile = useRef( null );

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

			// Godam gallery cleanup if needed
			const godamGalleryModalCloser = document.querySelector( '.godam-modal.is-gallery .godam-modal-close' );
			if ( godamGalleryModalCloser ) {
				godamGalleryModalCloser.click();
			}
		};
	}, [ videoFigureId, memoizedStoreObj ] );

	/**
	 * Handles the like button click event.
	 *
	 * If the user is not logged in, the function returns immediately.
	 * Otherwise, it sets the isSending state to true, dispatches an
	 * action to like the video, and sets the isSending state to false
	 * after a 1-second delay.
	 */
	function handleLike() {
		if ( ! isUserLoggedIn ) {
			return;
		}
		setIsSending( true );
		memoizedStoreObj.dispatch.userHitLike( videoAttachmentId, siteUrl, memoizedStoreObj );
		setTimeout( () => {
			setIsSending( false );
		}, 500 );
	}

	return (
		<div className={ `${ baseClass } ${ videoRatioClass }` }>
			<div className={ baseClass + '-content' + ( skipEngagements ? ' is-skip-engagements' : '' ) }>
				<div className={ baseClass + '-header' }>
					<h3 className={ baseClass + '-title' }>{ titles }</h3>
					<button className={ `${ baseClass }--close-button` } onClick={ () => memoizedStoreObj.root.unmount() }>&times;</button>
				</div>
				<div className={ baseClass + '--video' }>
					<div className={ `${ baseClass }--video-figure` }>
						<figure ref={ videoContainerRef }></figure>
					</div>
					{ ! skipEngagements && (
						<>
							<div
								className={ baseClass + '--video-info' + ( expendComment ? ' is-comment-expanded' : '' ) }
								onWheel={ ( e ) => e.stopPropagation() }
								ref={ videoInfoForMobile }
							>
								<h3 className={ baseClass + '--video-info-title' }>
									{
										commentsCount > 3 && (
											<button
												className={ baseClass + '--video-info-expend' }
												onClick={ () => setExpendComment( ! expendComment ) }>
												{ expendComment ? '-' : '+' }
											</button>
										)
									}
									{ __( 'Comments', 'godam' ) } ({ commentsCount })
									<button
										className={ baseClass + '--video-info-close' }
										onClick={ () => videoInfoForMobile.current.classList.toggle( 'show' ) }
									>
										{ __( 'Hide Comments', 'godam' ) }
									</button>
								</h3>
								<CommentList { ...props } commentsData={ commentsData } setCommentsData={ setCommentsData } isUserLoggedIn={ isUserLoggedIn } storeObj={ memoizedStoreObj } videoContainerRef={ videoContainerRef } />
								<div className={ baseClass + '-leave-comment' }>
									<div className={ baseClass + '-leave-comment-impressions' }>
										<button
											onClick={ handleLike }
											className={ baseClass + '-leave-comment-impressions-likes' + ( isUserLiked ? ' is-liked' : '' ) + ( isSending ? ' is-progressing' : '' ) }
										>{ likesCount }</button>
										<span className={ baseClass + '-leave-comment-impressions-views' }>{ viewsCount }</span>
									</div>
									{ isUserLoggedIn ? (
										<CommentForm setCommentsData={ setCommentsData } storeObj={ memoizedStoreObj } videoContainerRef={ videoContainerRef } videoAttachmentId={ videoAttachmentId } comment={ {} } siteUrl={ siteUrl } type="reply" commentType="new" />
									) : (
										<GuestLoginForm setIsUserLoggedIn={ setIsUserLoggedIn } siteUrl={ siteUrl } baseClass={ baseClass } storeObj={ memoizedStoreObj } />
									) }
								</div>
							</div>
							{
								'rtgodam-video-engagement-dynamic-ratio-9-16' === videoRatioClass && (
									<div className={ baseClass + '--mobile-engagements' }>
										<button
											className={ baseClass + '--mobile-engagements-button like' + ( isUserLiked ? ' is-liked' : '' ) + ( isSending ? ' is-progressing' : '' ) }
											onClick={ handleLike }
										>
											{ likesCount }
										</button>
										<button
											className={ baseClass + '--mobile-engagements-button comment' } onClick={ () => videoInfoForMobile.current.classList.toggle( 'show' ) }>
											{ commentsCount }
										</button>
										<span
											className={ baseClass + '--mobile-engagements-button view' }
										>
											{ viewsCount }
										</span>
									</div>
								)
							}
						</>
					) }
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
	return engagementStore.init();
}
