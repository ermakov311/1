type ApiSuccess<T> = { success: true; data: T } | { success: true } | Record<string, unknown>;
type ApiError = { success: false; error?: string } | { error?: string } | Record<string, unknown>;

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, { ...(init || {}), credentials: 'include' });
	if (!res.ok) {
		let errorData: ApiError | undefined;
		try {
			errorData = await res.json();
		} catch {
			// ignore body parse error
		}
		const message =
			(typeof errorData === 'object' && errorData && 'error' in errorData && typeof (errorData as any).error === 'string'
				? (errorData as any).error
				: undefined) || `HTTP error! status: ${res.status}`;
		throw Object.assign(new Error(message), { status: res.status });
	}
	let data: unknown;
	try {
		data = await res.json();
	} catch {
		data = {};
	}
	if (data && typeof data === 'object' && 'success' in (data as any)) {
		const d = data as ApiSuccess<T> & { success?: boolean } & { error?: string };
		if ((d as any).success === false) {
			throw new Error((d as any).error || 'API call failed');
		}
	}
	return data as T;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
	return apiFetch<T>(url, { ...(init || {}), method: 'GET' });
}

export async function apiPost<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
	return apiFetch<T>(url, {
		...(init || {}),
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers || {}),
		},
		body: JSON.stringify(body),
	});
}

export async function apiPut<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
	return apiFetch<T>(url, {
		...(init || {}),
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers || {}),
		},
		body: JSON.stringify(body),
	});
}

export async function apiDelete<T>(url: string, init?: RequestInit): Promise<T> {
	return apiFetch<T>(url, { ...(init || {}), method: 'DELETE' });
}






