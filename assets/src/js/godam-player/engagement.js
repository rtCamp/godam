const { createReduxStore, register, select, dispatch, subscribe } = wp.data;
const { apiFetch } = wp;
const { addQueryArgs } = wp.url;
const { createRoot, useState } = wp.element;
const { nonceData, DOMPurify } = window;

const DEFAULT_STATE = {
	views: {},
	likes: {},
	IsUserLiked: {},
	comments: {},
};

const ACTIONS = {
	LOAD_VIDEO_ENGAGEMENT_DATA: 'LOAD_VIDEO_ENGAGEMENT_DATA',
	USER_HIT_LIKE: 'USER_HIT_LIKE',
	USER_VIEWED: 'USER_VIEWED',
};

const engagementStore = {
	init() {
		this.initStore();
	},

	initStore() {
		register( this.store() );
		this.unsubscribe = subscribe(
			this.watch.bind( this ),
			'godam-video-engagement',
		);
		this.dispatch = dispatch( 'godam-video-engagement' );
		this.select = select( 'godam-video-engagement' );

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
			case ACTIONS.USER_VIEWED:
				return {
					...state,
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
		userShared: () => {
			return {
				type: ACTIONS.USER_VIEWED,
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
		collections.forEach( ( item ) => {
			engagementLikesData[ item.videoAttachmentId ] = item.data.likes_count;
			engagementIsUserLikedData[ item.videoAttachmentId ] = item.data.is_liked;
			engagementViewsData[ item.videoAttachmentId ] = item.data.views_count;
		} );

		return {
			views: engagementViewsData,
			likes: engagementLikesData,
			IsUserLiked: engagementIsUserLikedData,
		};
	},

	distributeData( state ) {
		const likes = state.likes;
		const views = state.views;
		const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );
		if ( 0 === videoIds.length ) {
			return null;
		}
		videoIds.forEach( ( item ) => {
			const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
			const likeLink = item.querySelector( '.rtgodam-video-engagement--like-link' );
			const likeCount = item.querySelector( '.rtgodam-video-engagement--like-count' );
			const viewCount = item.querySelector( '.rtgodam-video-engagement--view-count' );
			likeLink.classList.toggle( 'is-liked', state.IsUserLiked[ videoAttachmentId ] );
			likeCount.innerHTML = DOMPurify.sanitize( likes[ videoAttachmentId ] ) || 0;
			viewCount.innerHTML = DOMPurify.sanitize( views[ videoAttachmentId ] ) || 0;
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

function CommentBox( { videoAttachmentId, siteUrl, storeObj } ) {
	const baseClass = 'rtgodam-video-engagement--comment-modal';
	const comments = storeObj.select.getComments()[ videoAttachmentId ] || {};
	const [ commentData, setCommentData ] = useState( comments );

	return (
		<div className={ baseClass }>
			<button className={ `${ baseClass }--close-button` } onClick={ () => storeObj.root.unmount() }>&times;</button>
			<div className={ 'rtgodam-video-engagement--comment-modal-content' }>
				Comments will appear here
			</div>
		</div>
	);
}

export function engagement() {
	engagementStore.init();
}
