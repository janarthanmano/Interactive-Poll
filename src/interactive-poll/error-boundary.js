import { Component } from '@wordpress/element';

export class ErrorBoundary extends Component {
	state = { hasError: false };

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error, info) {
		console.error('Poll Error:', error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="poll-error">
					Failed to load poll. Please refresh the page.
				</div>
			);
		}
		return this.props.children;
	}
}
