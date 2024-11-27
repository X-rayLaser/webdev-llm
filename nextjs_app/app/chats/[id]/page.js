import PageWithSidePanel from "../PageWithSidePanel";

export default async function Page(props) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const id = params.id;

    const response = await fetch(`http://django:8000/api/chats/${id}/`);
    const data = await response.json();
    console.log(response.status, data)

    return (
        <PageWithSidePanel searchParams={searchParams}>
            <div>{data.name}</div>
            <div>{data.messages.map(msg => <div>{msg}</div>)}</div>
        </PageWithSidePanel>
    );
}