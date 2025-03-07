/**
 * Use this file for JavaScript code that you want to run in the front-end
 * on posts/pages that contain this block.
 *
 * When this file is defined as the value of the `viewScript` property
 * in `block.json` it will be enqueued on the front end of the site.
 *
 * Example:
 *
 * ```js
 * {
 *   "viewScript": "file:./view.js"
 * }
 * ```
 *
 * If you're not making any changes to this file because your project doesn't need any
 * JavaScript running in the front-end, then you should delete this file and remove
 * the `viewScript` property from `block.json`.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#view-script
 */
import { __ } from '@wordpress/i18n';
import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { ErrorBoundary } from './error-boundary';
import './style.scss';
const PollFrontend = ({ attributes, postId }) => {
	const { question, options, pollId, expiration } = attributes;
	const [hasVoted, setHasVoted] = useState(false);
	const [votes, setVotes] = useState(() =>
		new Array(attributes.options?.length || 0).fill(0)
	);
	const [ isLoading, setIsLoading] = useState(false);
	const [ isExpired, setIsExpired] = useState(false);

	//Check if the results should be displayed if the user has voted or the poll has expired.
	const showResults = hasVoted || isExpired;

	const fetchResults = useCallback(async () => {
		//create a unique key for the poll to store the results locally.
		const cacheKey = `poll_${postId}_${pollId}_results`;

		//store results in local storage for 1 min
		const CACHE_DURATION = 60 * 1000;

		try {
			//checking if the data exists in local
			const cached = sessionStorage.getItem(cacheKey);
			if (cached) {
				const { timestamp, data } = JSON.parse(cached);
				if (Date.now() - timestamp < CACHE_DURATION) {
					setVotes(data);
					return;
				}
			}

			//if no local storage or data expired then fetch from server
			setIsLoading(true);

			const response = await apiFetch({
				path: `/interactive-poll/v1/results?post_id=${postId}&poll_id=${pollId}`
			});

			//validating the response
			if (!response || typeof response.votes !== 'object' || response.votes === null) {
				throw new Error('Invalid API response format');
			}

			//response object to array
			const votesArray = new Array(options.length).fill(0);
			Object.entries(response.votes).forEach(([key, value]) => {
				const index = parseInt(key, 10);
				if (!isNaN(index) && index >= 0 && index < options.length) {
					votesArray[index] = Math.max(0, Number(value));
				}
			});

			// Update state and cache
			setVotes(votesArray);
			sessionStorage.setItem(cacheKey, JSON.stringify({
				timestamp: Date.now(),
				data: votesArray
			}));

		} catch (error) {
			console.error('Fetch results failed:', error);
			// Fallback to empty array matching options length
			const fallbackVotes = new Array(options.length).fill(0);
			setVotes(fallbackVotes);
			sessionStorage.removeItem(cacheKey);
		} finally {
			setIsLoading(false);
		}
	}, [postId, pollId, options.length]);

	useEffect(() => {
		const checkVoteStatus = () => {
			//Setting cookie to find out if the user voted a poll to display only results.
			const cookie = document.cookie.match(`(^|;) ?interactive_poll_${pollId}=([^;]*)(;|$)`);
			if (cookie) {
				setHasVoted(true);
				fetchResults();
			}
		};

		checkVoteStatus();

		const cacheKey = `poll_${postId}_${pollId}_results`;
		sessionStorage.removeItem(cacheKey);

		return () => {
			setIsLoading(false);
			setVotes([]);
		};
	}, [pollId, fetchResults, postId]);

	//Check if the poll has expired and fetch the final result to display
	useEffect(() => {
		const checkExpiration = () => {
			if (!expiration) return;

			const now = Date.now();
			const expirationDate = new Date(expiration).getTime();
			const timeLeft = expirationDate - now;

			if (timeLeft <= 0) {
				setIsExpired(true);
				fetchResults()
				return;
			}

			//Setting a timout to timeleft for the poll to expire, so a fetch is done at the end of the poll time.
			const timeout = setTimeout(() => {
				setIsExpired(true);
				fetchResults();
			}, timeLeft);

			return () => clearTimeout(timeout);
		};

		checkExpiration();
	}, [expiration, fetchResults]);

	const handleVote = async (index) => {

		//don't need to handle is the poll has expired.
		if (isExpired) return;

		if (
			isLoading ||
			hasVoted ||
			typeof index !== 'number' ||
			index < 0 ||
			index >= options.length
		) return;

		try {
			setIsLoading(true);

			//clearing cached result so fresh result is fetched as soon as the user vote
			const cacheKey = `poll_${postId}_${pollId}_results`;
			sessionStorage.removeItem(cacheKey);

			//post request to custom API route to register the vote
			await apiFetch({
				path: '/interactive-poll/v1/vote',
				method: 'POST',
				data: {
					post_id: postId,
					poll_id: pollId,
					option_index: index
				}
			});

			//creating cookie to find if the user voted and saving the index to display the option voted by user
			document.cookie = `interactive_poll_${pollId}=${index}; max-age=2592000; path=/`;

			await fetchResults();
			setHasVoted(true);
		} catch (error) {
			console.error('Error submitting vote:', error);
		} finally {
			setIsLoading(false);
		}
	};

	//Loading animation
	if (isLoading) {
		return (
			<div className="poll-loading">
				<div className="spinner"></div>
				<p>Loading poll results...</p>
			</div>
		);
	}

	const totalVotes = Array.isArray(votes)
		? votes.reduce((sum, count) => sum + (Number.isInteger(count) ? count : 0), 0)
		: 0;

	return (
		<div className={`interactive-poll ${isExpired ? 'poll-expired' : ''}`}>
			{expiration && (
				<div className="poll-expiration">
					{isExpired ? (
						<span>Poll closed • Final results</span>
					) : (
						<span>
              Voting open until: {new Date(expiration).toLocaleString()}
            </span>
					)}
				</div>
			)}

			<h3>{ question || __("Poll Question", "interactive-poll") }</h3>

			{!showResults ? (
				<div className="poll-options">
					{options.map((option, index) => (
						<button
							onClick={() => handleVote(index)}
							disabled={hasVoted || isLoading}
							aria-label={`Vote for option ${option.text}`}
							role="option"
						>
							{option.imageUrl ? (
								<div>
									<img src={option.imageUrl} alt={option.text}/>
									<span>{option.text}</span>
								</div>
							) : (
								<span>{option.text}</span>
							)}
						</button>
					))}
				</div>
			) : (
				<div>
					<div className="poll-results">
						{options.map((option, index) => {
							const count = Array.isArray(votes) && votes[index] ? votes[index] : 0;
							const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
							// Get voted index from cookie
							const votedIndex = document.cookie.match(`interactive_poll_${pollId}=(\\d+)`)?.[1];

							//console.log('votedIndex', votedIndex);
							//console.log('index', index);
							return (
								<div key={index}
									 className="result-item">
									<div className={`result-label ${index === parseInt(votedIndex) ? 'voted-option' : ''}`}>
										{option.imageUrl ? (
											<div>
												<img src={option.imageUrl} alt={option.text}/>
												<span>{option.text}</span>
											</div>
										) : (
											<span>{option.text}</span>
										)}
									</div>
									<div className="result-bar">
										<span className="result-percentage">{percentage}%</span>
										<div
											className="result-progress"
											style={{width: `${percentage}%`}}
										></div>
									</div>
								</div>
							);
						})}
					</div>
					<div className="total-votes"><p>Total Votes: {totalVotes}</p></div>
				</div>
			)}
		</div>
	);
};

document.querySelectorAll('.wp-block-custom-interactive-poll').forEach(container => {
	const attributes = JSON.parse(container.dataset.attributes);
	const postId = parseInt(container.dataset.postId);

	createRoot(container).render(
		<ErrorBoundary>
			<PollFrontend
				attributes={attributes}
				postId={postId}
			/>
		</ErrorBoundary>
	);
});
