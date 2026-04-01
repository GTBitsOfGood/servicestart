"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { isAdmin } from "@/lib/clientUtils";
import BogRadioGroup from "@/components/bog/BogRadioGroup/BogRadioGroup";
import BogRadioItem from "@/components/bog/BogRadioItem/BogRadioItem";

export default function EventsCreationPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const { organization } = useActiveOrganization();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [eventCapacity, setEventCapacity] = useState("");
  const [deadline, setDeadline] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [hosts, setHosts] = useState<string[]>([""]);
  const [visibility, setVisibility] = useState("public");
  const [missing, setMissing] = useState(false);
  const [wrongTime, setWrongTime] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [exit, setExit] = useState(false);

  const handleExit = async () => {
    router.push("/events");
  };

  const handleSubmit = async () => {
    if (
      title === "" ||
      date === "" ||
      startTime === "" ||
      endTime === "" ||
      description === "" ||
      address === "" ||
      city === "" ||
      state === "" ||
      zipCode === ""
    ) {
      setMissing(true);
      return;
    }

    const startingTime = new Date(`${date}T${startTime}`);
    const endingTime = new Date(`${date}T${endTime}`);
    const timeDiff = endingTime.getTime() - startingTime.getTime();
    if (timeDiff <= 0) {
      setWrongTime(true);
      return;
    }
    const duration = Math.floor(timeDiff / (1000 * 60));
    const linksNoEmpty = links.filter((l) => l.trim() !== "");
    const hostsNoEmpty = hosts.filter((h) => h.trim() !== "");

    const body = {
      name: title,
      location: `${address}, ${city}, ${state}, ${zipCode}`,
      startTimestamp: startingTime.toISOString(),
      duration: `${duration} minutes`,
      description: 1,
      visibility: visibility,
      ...(eventCapacity != "" && {
        rsvpLimit: Math.max(1, parseInt(eventCapacity, 10)),
      }),
      ...(deadline != "" && { rsvpDeadline: deadline }),
      ...(notes != "" && { accessibilityNotes: notes }),
      ...(linksNoEmpty.length > 0 && { links: linksNoEmpty }),
      ...(hostsNoEmpty.length > 0 && { hosts: hostsNoEmpty }),
    };

    try {
      const response = await fetch("/api/events/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setHasError(true);
        return;
      }

      router.push("/events");
    } catch {
      setHasError(true);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const userIsAdmin = isAdmin(organization?.data, session?.data?.user);
      if (!userIsAdmin) {
        router.push("/");
      }
    };

    if (session?.isPending || organization?.isPending) {
      return;
    }

    if (session?.data?.user && organization?.data) {
      checkAdmin();
    } else {
      router.push("/");
    }
  }, [
    session?.data?.user,
    organization?.data,
    session?.isPending,
    organization?.isPending,
    router,
  ]);

  return (
    <div className="flex w-full px-14 py-12 flex-col items-center gap-12 rounded bg-white">
      <div className="h-[68.717px] w-[90%] flex flex-col justify-between">
        <div className="flex w-full justify-between items-center">
          <h3>Event Creation Form</h3>
          <BogButton onClick={() => setExit(true)} className="bg-transparent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 30 30"
              fill="none"
            >
              <path
                d="M23.6075 21.791C23.8485 22.032 23.984 22.359 23.984 22.6999C23.984 23.0408 23.8485 23.3677 23.6075 23.6087C23.3664 23.8498 23.0395 23.9852 22.6986 23.9852C22.3577 23.9852 22.0308 23.8498 21.7897 23.6087L15.0009 16.8178L8.20987 23.6066C7.96882 23.8477 7.64188 23.9831 7.30099 23.9831C6.96009 23.9831 6.63315 23.8477 6.3921 23.6066C6.15105 23.3656 6.01563 23.0386 6.01562 22.6977C6.01562 22.3568 6.15105 22.0299 6.3921 21.7888L13.1831 15L6.39424 8.20899C6.15318 7.96794 6.01776 7.641 6.01776 7.3001C6.01776 6.9592 6.15318 6.63227 6.39424 6.39121C6.63529 6.15016 6.96222 6.01474 7.30312 6.01474C7.64402 6.01474 7.97096 6.15016 8.21201 6.39121L15.0009 13.1822L21.7919 6.39014C22.0329 6.14909 22.3598 6.01367 22.7007 6.01367C23.0416 6.01367 23.3686 6.14909 23.6096 6.39014C23.8507 6.6312 23.9861 6.95813 23.9861 7.29903C23.9861 7.63993 23.8507 7.96687 23.6096 8.20792L16.8186 15L23.6075 21.791Z"
                style={{ fill: "var(--color-grey-text-strong)" }}
              />
            </svg>
          </BogButton>
        </div>
        <div className="w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1053 1"
            fill="none"
            className="w-full h-auto"
          >
            <path
              d="M0 0.5L1053 0.500111"
              style={{ stroke: "var(--color-media-border)" }}
            />
          </svg>
        </div>
      </div>
      <div className="flex flex-col items-end gap-15 w-[90%]">
        <div className="flex flex-col items-start gap-9 self-stretch w-full">
          <h4>Basic Information</h4>
          <div>
            <BogTextInput
              name="title"
              label="Title"
              required={true}
              placeholder="Title of the event"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={missing && title === ""}
              className="self-start gap-2"
            />
            {missing && title === "" && (
              <div className="text-[var(--color-status-red-text)] text-small">
                Missing
              </div>
            )}
          </div>
          <div className="flex items-start gap-6 self-stretch">
            <div className="w-[37%]">
              <BogTextInput
                name="date"
                label="Date"
                type="date"
                required={true}
                value={date}
                error={missing && date === ""}
                onChange={(e) => setDate(e.target.value)}
              />
              {missing && date === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
            <div className="w-[21%]">
              <BogTextInput
                name="start"
                label="Start Time"
                type="time"
                required={true}
                value={startTime}
                error={missing && startTime === ""}
                onChange={(e) => setStartTime(e.target.value)}
              />
              {missing && startTime === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
            <div className="w-[21%]">
              <BogTextInput
                name="end"
                label="End Time"
                type="time"
                required={true}
                value={endTime}
                error={missing && endTime === ""}
                onChange={(e) => setEndTime(e.target.value)}
              />
              {missing && endTime === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
          </div>
          <div className="self-stretch">
            <BogTextInput
              name="description"
              label="Description"
              required={true}
              multiline={true}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={missing && description === ""}
              placeholder="Write your description here"
            />
            {missing && description === "" && (
              <div className="text-[var(--color-status-red-text)] text-small">
                Missing
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-6 self-stretch">
          <h4>Event Location</h4>
          <div className="flex items-start gap-10 self-stretch">
            <div className="w-[37%]">
              <BogTextInput
                name="address"
                label="Address"
                placeholder="Detailed address"
                required={true}
                value={address}
                error={missing && address === ""}
                onChange={(e) => setAddress(e.target.value)}
              />
              {missing && address === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
            <div className="w-[21%]">
              <BogTextInput
                name="city"
                label="City"
                placeholder="City"
                required={true}
                value={city}
                error={missing && city === ""}
                onChange={(e) => setCity(e.target.value)}
              />
              {missing && city === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
            <div className="w-[21%]">
              <BogTextInput
                name="state"
                label="State"
                placeholder="State"
                required={true}
                value={state}
                error={missing && state === ""}
                onChange={(e) => setState(e.target.value)}
              />
              {missing && state === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
            <div className="w-[21%]">
              <BogTextInput
                name="zip"
                label="Zip Code"
                placeholder="00000"
                required={true}
                value={zipCode}
                error={missing && zipCode === ""}
                onChange={(e) => setZipCode(e.target.value)}
              />
              {missing && zipCode === "" && (
                <div className="text-[var(--color-status-red-text)] text-small">
                  Missing
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-9 self-stretch">
          <h4>Additional Information</h4>
          <div className="flex items-center gap-10 self-stretch">
            <BogTextInput
              name="capacity"
              label="Event Capacity"
              placeholder="Enter a number"
              value={eventCapacity}
              onChange={(e) => setEventCapacity(e.target.value)}
              className="w-[18%]"
            />
            <BogTextInput
              name="deadline"
              label="Registration Deadline"
              type="date"
              placeholder="Enter a date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-[18%]"
            />
          </div>
          <div className="w-full flex flex-col gap-2 items-start">
            {links.map((link, index) => (
              <BogTextInput
                key={index}
                name={`link${index}`}
                label={index === 0 ? "External Links" : ""}
                value={link}
                onChange={(e) => {
                  const updated = [...links];
                  updated[index] = e.target.value;
                  setLinks(updated);
                }}
                placeholder="URL must be in the form https://www.example.[com, org, net, etc.]"
                className="w-full"
              />
            ))}
            <BogButton
              className="bg-white text-[var(--color-brand-text)]"
              onClick={() => setLinks([...links, ""])}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M15.9901 9.99991C15.9901 10.1906 15.9143 10.3734 15.7795 10.5082C15.6447 10.643 15.4619 10.7187 15.2712 10.7187H10.7187V15.2712C10.7187 15.4619 10.643 15.6447 10.5082 15.7795C10.3734 15.9143 10.1906 15.9901 9.99991 15.9901C9.80927 15.9901 9.62643 15.9143 9.49163 15.7795C9.35682 15.6447 9.28109 15.4619 9.28109 15.2712V10.7187H4.72858C4.53794 10.7187 4.35511 10.643 4.2203 10.5082C4.0855 10.3734 4.00977 10.1906 4.00977 9.99991C4.00977 9.80927 4.0855 9.62643 4.2203 9.49163C4.35511 9.35682 4.53794 9.28109 4.72858 9.28109H9.28109V4.72858C9.28109 4.53794 9.35682 4.35511 9.49163 4.2203C9.62643 4.0855 9.80927 4.00977 9.99991 4.00977C10.1906 4.00977 10.3734 4.0855 10.5082 4.2203C10.643 4.35511 10.7187 4.53794 10.7187 4.72858V9.28109H15.2712C15.4619 9.28109 15.6447 9.35682 15.7795 9.49163C15.9143 9.62643 15.9901 9.80927 15.9901 9.99991Z"
                  style={{ fill: "var(--color-brand-text)" }}
                />
              </svg>
              Add another
            </BogButton>
          </div>
          <BogTextInput
            name="accessibility"
            label="Accessibility Notes"
            placeholder="Write your notes here"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="self-stretch"
          />
        </div>
        <div className="flex flex-col items-start gap-9 self-stretch w-full">
          <h4>Ownerships</h4>
          <div className="w-full flex flex-col gap-2 items-start">
            {hosts.map((host, index) => (
              <BogTextInput
                key={`${index}host`}
                name={`${index}cohost`}
                label={index === 0 ? "Add a co-host" : ""}
                value={host}
                onChange={(e) => {
                  const updated = [...hosts];
                  updated[index] = e.target.value;
                  setHosts(updated);
                }}
                placeholder="Enter co-host email"
                className="self-stretch"
              />
            ))}
            <BogButton
              className="bg-white text-[var(--color-brand-text)]"
              onClick={() => setHosts([...hosts, ""])}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M15.9901 9.99991C15.9901 10.1906 15.9143 10.3734 15.7795 10.5082C15.6447 10.643 15.4619 10.7187 15.2712 10.7187H10.7187V15.2712C10.7187 15.4619 10.643 15.6447 10.5082 15.7795C10.3734 15.9143 10.1906 15.9901 9.99991 15.9901C9.80927 15.9901 9.62643 15.9143 9.49163 15.7795C9.35682 15.6447 9.28109 15.4619 9.28109 15.2712V10.7187H4.72858C4.53794 10.7187 4.35511 10.643 4.2203 10.5082C4.0855 10.3734 4.00977 10.1906 4.00977 9.99991C4.00977 9.80927 4.0855 9.62643 4.2203 9.49163C4.35511 9.35682 4.53794 9.28109 4.72858 9.28109H9.28109V4.72858C9.28109 4.53794 9.35682 4.35511 9.49163 4.2203C9.62643 4.0855 9.80927 4.00977 9.99991 4.00977C10.1906 4.00977 10.3734 4.0855 10.5082 4.2203C10.643 4.35511 10.7187 4.53794 10.7187 4.72858V9.28109H15.2712C15.4619 9.28109 15.6447 9.35682 15.7795 9.49163C15.9143 9.62643 15.9901 9.80927 15.9901 9.99991Z"
                  style={{ fill: "var(--color-brand-text)" }}
                />
              </svg>
              Add another
            </BogButton>
          </div>
        </div>
        <div className="flex flex-col items-start gap-9 self-stretch w-full">
          <h4>Visibility</h4>
          <BogRadioGroup
            value={visibility}
            onValueChange={setVisibility}
            className="flex flex-col justify-center items-start self-stretch gap-2"
          >
            <BogRadioItem
              value="public"
              label="Public"
              className="flex h-[44px] px-2 py-3 items-center gap-2 self-stretch rounded border border-[var(--color-media-divider)] bg-[var(--color-media-page-bg)]"
            />
            <BogRadioItem
              value="member-only"
              label="Member only"
              className="flex h-[44px] px-2 py-3 items-center gap-2 self-stretch rounded border border-[var(--color-media-divider)] bg-[var(--color-media-page-bg)]"
            />
          </BogRadioGroup>
        </div>
        {missing && (
          <div className="w-full flex flex-row items-center p-4 gap-2 self-stretch rounded bg-[var(--color-brand-stroke-weak)] min-h-[40px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M8.85226 0C7.10145 0 5.38996 0.519176 3.93421 1.49187C2.47846 2.46457 1.34385 3.84711 0.673842 5.46464C0.00383554 7.08218 -0.171469 8.86207 0.170098 10.5792C0.511664 12.2964 1.35476 13.8737 2.59277 15.1117C3.83078 16.3498 5.4081 17.1928 7.12527 17.5344C8.84244 17.876 10.6223 17.7007 12.2399 17.0307C13.8574 16.3607 15.2399 15.226 16.2126 13.7703C17.1853 12.3146 17.7045 10.6031 17.7045 8.85225C17.702 6.50525 16.7686 4.25509 15.109 2.5955C13.4494 0.93592 11.1993 0.00247848 8.85226 0ZM8.51179 4.08566C8.7138 4.08566 8.91128 4.14556 9.07925 4.25779C9.24722 4.37003 9.37814 4.52955 9.45545 4.71619C9.53276 4.90283 9.55299 5.1082 9.51357 5.30634C9.47416 5.50447 9.37688 5.68647 9.23404 5.82932C9.09119 5.97217 8.90919 6.06945 8.71106 6.10886C8.51292 6.14827 8.30755 6.12804 8.12091 6.05073C7.93427 5.97342 7.77475 5.84251 7.66251 5.67454C7.55028 5.50657 7.49037 5.30909 7.49037 5.10707C7.49037 4.83617 7.59799 4.57637 7.78954 4.38482C7.98109 4.19327 8.24089 4.08566 8.51179 4.08566ZM9.5332 13.6189C9.17201 13.6189 8.82561 13.4754 8.5702 13.22C8.3148 12.9646 8.17132 12.6182 8.17132 12.257V8.85225C7.99072 8.85225 7.81752 8.78051 7.68982 8.65281C7.56212 8.52511 7.49037 8.35191 7.49037 8.17131C7.49037 7.99071 7.56212 7.81751 7.68982 7.68981C7.81752 7.56211 7.99072 7.49037 8.17132 7.49037C8.53251 7.49037 8.87891 7.63385 9.13431 7.88926C9.38972 8.14466 9.5332 8.49106 9.5332 8.85225V12.257C9.7138 12.257 9.887 12.3287 10.0147 12.4564C10.1424 12.5841 10.2141 12.7573 10.2141 12.9379C10.2141 13.1185 10.1424 13.2917 10.0147 13.4194C9.887 13.5471 9.7138 13.6189 9.5332 13.6189Z"
                style={{ fill: "var(--color-status-red-text)" }}
              />
            </svg>
            <p>Please fill out all required fields</p>
          </div>
        )}
        {wrongTime && (
          <div className="w-full flex flex-row items-center p-4 gap-2 self-stretch rounded bg-[var(--color-brand-stroke-weak)] min-h-[40px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M8.85226 0C7.10145 0 5.38996 0.519176 3.93421 1.49187C2.47846 2.46457 1.34385 3.84711 0.673842 5.46464C0.00383554 7.08218 -0.171469 8.86207 0.170098 10.5792C0.511664 12.2964 1.35476 13.8737 2.59277 15.1117C3.83078 16.3498 5.4081 17.1928 7.12527 17.5344C8.84244 17.876 10.6223 17.7007 12.2399 17.0307C13.8574 16.3607 15.2399 15.226 16.2126 13.7703C17.1853 12.3146 17.7045 10.6031 17.7045 8.85225C17.702 6.50525 16.7686 4.25509 15.109 2.5955C13.4494 0.93592 11.1993 0.00247848 8.85226 0ZM8.51179 4.08566C8.7138 4.08566 8.91128 4.14556 9.07925 4.25779C9.24722 4.37003 9.37814 4.52955 9.45545 4.71619C9.53276 4.90283 9.55299 5.1082 9.51357 5.30634C9.47416 5.50447 9.37688 5.68647 9.23404 5.82932C9.09119 5.97217 8.90919 6.06945 8.71106 6.10886C8.51292 6.14827 8.30755 6.12804 8.12091 6.05073C7.93427 5.97342 7.77475 5.84251 7.66251 5.67454C7.55028 5.50657 7.49037 5.30909 7.49037 5.10707C7.49037 4.83617 7.59799 4.57637 7.78954 4.38482C7.98109 4.19327 8.24089 4.08566 8.51179 4.08566ZM9.5332 13.6189C9.17201 13.6189 8.82561 13.4754 8.5702 13.22C8.3148 12.9646 8.17132 12.6182 8.17132 12.257V8.85225C7.99072 8.85225 7.81752 8.78051 7.68982 8.65281C7.56212 8.52511 7.49037 8.35191 7.49037 8.17131C7.49037 7.99071 7.56212 7.81751 7.68982 7.68981C7.81752 7.56211 7.99072 7.49037 8.17132 7.49037C8.53251 7.49037 8.87891 7.63385 9.13431 7.88926C9.38972 8.14466 9.5332 8.49106 9.5332 8.85225V12.257C9.7138 12.257 9.887 12.3287 10.0147 12.4564C10.1424 12.5841 10.2141 12.7573 10.2141 12.9379C10.2141 13.1185 10.1424 13.2917 10.0147 13.4194C9.887 13.5471 9.7138 13.6189 9.5332 13.6189Z"
                style={{ fill: "var(--color-status-red-text)" }}
              />
            </svg>
            <p>Start time must be before end time</p>
          </div>
        )}
        <div className="flex flex-end items-start gap-5">
          <BogButton
            onClick={() => setExit(true)}
            className="flex py-3 px-4 items-center -space-x-1 rounded bg-transparent text-[var(--color-brand-text)]"
          >
            Cancel
          </BogButton>
          <BogButton
            onClick={handleSubmit}
            className="flex py-3 px-4 items-center -space-x-1 rounded"
          >
            Create Event
          </BogButton>
        </div>
      </div>
      {exit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="flex w-[38%] p-8 flex-col items-center gap-4 bg-white rounded">
            <div className="h-[68.717px] self-stretch">
              <div className="w-full">
                <div className="inline-flex w-full justify-between items-center">
                  <h4>Discard changes</h4>
                  <BogButton
                    onClick={() => setExit(false)}
                    className="bg-transparent"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="30"
                      height="30"
                      viewBox="0 0 30 30"
                      fill="none"
                    >
                      <path
                        d="M23.6075 21.791C23.8485 22.032 23.984 22.359 23.984 22.6999C23.984 23.0408 23.8485 23.3677 23.6075 23.6087C23.3664 23.8498 23.0395 23.9852 22.6986 23.9852C22.3577 23.9852 22.0308 23.8498 21.7897 23.6087L15.0009 16.8178L8.20987 23.6066C7.96882 23.8477 7.64188 23.9831 7.30099 23.9831C6.96009 23.9831 6.63315 23.8477 6.3921 23.6066C6.15105 23.3656 6.01563 23.0386 6.01562 22.6977C6.01562 22.3568 6.15105 22.0299 6.3921 21.7888L13.1831 15L6.39424 8.20899C6.15318 7.96794 6.01776 7.641 6.01776 7.3001C6.01776 6.9592 6.15318 6.63227 6.39424 6.39121C6.63529 6.15016 6.96222 6.01474 7.30312 6.01474C7.64402 6.01474 7.97096 6.15016 8.21201 6.39121L15.0009 13.1822L21.7919 6.39014C22.0329 6.14909 22.3598 6.01367 22.7007 6.01367C23.0416 6.01367 23.3686 6.14909 23.6096 6.39014C23.8507 6.6312 23.9861 6.95813 23.9861 7.29903C23.9861 7.63993 23.8507 7.96687 23.6096 8.20792L16.8186 15L23.6075 21.791Z"
                        style={{ fill: "var(--color-grey-text-strong)" }}
                      />
                    </svg>
                  </BogButton>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="532"
                  height="1"
                  viewBox="0 0 532 1"
                  fill="none"
                >
                  <path
                    d="M0 0.5L532 0.500056"
                    style={{ stroke: "var(--color-media-border)" }}
                  />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-end gap-12 self-stretch ">
              <div className="flex flex-col items-start gap-12 self-stretch">
                <p className="self-stretch">
                  Are you sure you want to discard the changes you made?
                </p>
              </div>
              <div className="flex items-start gap-5">
                <BogButton
                  onClick={() => setExit(false)}
                  className="bg-transparent text-[var(--color-brand-text)]"
                >
                  Cancel
                </BogButton>
                <BogButton
                  onClick={handleExit}
                  className="flex py-2 px-3 items-center -gap-1"
                >
                  Discard
                </BogButton>
              </div>
            </div>
          </div>
        </div>
      )}
      {hasError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="flex w-[38%] p-8 flex-col items-center gap-4 bg-white rounded">
            <div className="h-[68.717px] self-stretch">
              <div className="w-full">
                <div className="inline-flex w-full justify-between items-center">
                  <h4>Event not created</h4>
                  <BogButton
                    onClick={() => setHasError(false)}
                    className="bg-transparent"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="30"
                      height="30"
                      viewBox="0 0 30 30"
                      fill="none"
                    >
                      <path
                        d="M23.6075 21.791C23.8485 22.032 23.984 22.359 23.984 22.6999C23.984 23.0408 23.8485 23.3677 23.6075 23.6087C23.3664 23.8498 23.0395 23.9852 22.6986 23.9852C22.3577 23.9852 22.0308 23.8498 21.7897 23.6087L15.0009 16.8178L8.20987 23.6066C7.96882 23.8477 7.64188 23.9831 7.30099 23.9831C6.96009 23.9831 6.63315 23.8477 6.3921 23.6066C6.15105 23.3656 6.01563 23.0386 6.01562 22.6977C6.01562 22.3568 6.15105 22.0299 6.3921 21.7888L13.1831 15L6.39424 8.20899C6.15318 7.96794 6.01776 7.641 6.01776 7.3001C6.01776 6.9592 6.15318 6.63227 6.39424 6.39121C6.63529 6.15016 6.96222 6.01474 7.30312 6.01474C7.64402 6.01474 7.97096 6.15016 8.21201 6.39121L15.0009 13.1822L21.7919 6.39014C22.0329 6.14909 22.3598 6.01367 22.7007 6.01367C23.0416 6.01367 23.3686 6.14909 23.6096 6.39014C23.8507 6.6312 23.9861 6.95813 23.9861 7.29903C23.9861 7.63993 23.8507 7.96687 23.6096 8.20792L16.8186 15L23.6075 21.791Z"
                        style={{ fill: "var(--color-grey-text-strong)" }}
                      />
                    </svg>
                  </BogButton>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="532"
                  height="1"
                  viewBox="0 0 532 1"
                  fill="none"
                >
                  <path
                    d="M0 0.5L532 0.500056"
                    style={{ stroke: "var(--color-media-border)" }}
                  />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-end gap-12 self-stretch ">
              <div className="flex flex-col items-start gap-12 self-stretch">
                <p className="self-stretch">
                  Your changes were not saved successfully! Your event has been
                  saved as a draft.
                </p>
              </div>
              <div className="flex items-start gap-5">
                <BogButton
                  onClick={() => setHasError(false)}
                  className="flex py-2 px-3 items-center -gap-1"
                >
                  Go to Draft
                </BogButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
