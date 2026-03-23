export default async function MemberRequestsWidget() {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-8">
      <h3 className="text-heading-3 font-semibold text-black">
        New Member Requests
      </h3>
      <div className="mt-4 flex flex-1 items-center justify-center text-paragraph-1 text-grey-text-weak">
        No pending requests
      </div>
    </div>
  );
}
