const { createReduxStore, register, select, dispatch, subscribe } = wp.data;

const DEFAULT_STATE = {
	views: 0,
	likes: 0,
	comments: {},
};

const ACTIONS = {
	USER_LIKED: 'USER_LIKED',
	USER_CANCELED_LIKED: 'USER_CANCELED_LIKED',
	USER_VIEWED: 'USER_VIEWED',
};

const engagementObj = {

	init() {
		register( this.store() );
		this.unsubscribe = subscribe( this.watch.bind( this ), 'godam-video-engagement' );
		this.dispatch = dispatch( 'godam-video-engagement' );
		this.select = select( 'godam-video-engagement' );

		// For testing purposes
		window.gdm_dispatch = this.dispatch;
		window.gdm_select = this.select;
	},

	reducer( state = DEFAULT_STATE, action ) {
		switch ( action.type ) {
			case ACTIONS.USER_LIKED:
				return {
					...state,
					likes: state.likes + 1,
				};
			case ACTIONS.USER_CANCELED_LIKED:
				return {
					...state,
					likes: state.likes - 1,
				};
			case ACTIONS.USER_VIEWED:
				return {
					...state,
					views: state.views + 1,
				};
			default:
				return state;
		}
	},

	actions: {
		userLiked: () => {
			return {
				type: ACTIONS.USER_LIKED,
			};
		},
		userCanceledLiked: () => {
			return {
				type: ACTIONS.USER_CANCELED_LIKED,
			};
		},
		userShared: () => {
			return {
				type: ACTIONS.USER_VIEWED,
			};
		},
	},

	selectors: {
		getViews: ( state ) => state.views,
		getLikes: ( state ) => state.likes,
		getComments: ( state ) => state.comments,
	},

	store() {
		return createReduxStore( 'godam-video-engagement', { reducer: this.reducer, actions: this.actions, selectors: this.selectors } );
	},

	watch() {
		const views = this.select.getViews();
		const likes = this.select.getLikes();
		const comments = this.select.getComments();

		// eslint-disable-next-line no-console
		console.log( 'Views:', views );
		console.log( 'Likes:', likes );
		console.log( 'Comments:', comments );
	},
};

export function engagement() {
	engagementObj.init();
}
