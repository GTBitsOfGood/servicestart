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
import api from "@/lib/api";
import { EventVisibility } from "@/lib/schema";
import WarningIcon from "@/components/WarningIcon";
import ExitIcon from "@/components/ExitIcon";
import PlusIcon from "@/components/PlusIcon";

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
  const [errorMessage, setErrorMessage] = useState("");

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
    } else {
      setMissing(false);
    }

    const startingTime = new Date(`${date}T${startTime}`);
    const endingTime = new Date(`${date}T${endTime}`);
    const timeDiff = endingTime.getTime() - startingTime.getTime();
    if (timeDiff <= 0) {
      setWrongTime(true);
      return;
    } else {
      setWrongTime(false);
    }

    const duration = Math.floor(timeDiff / (1000 * 60));
    const linksNoEmpty = links.filter((l) => l.trim() !== "");
    const hostsNoEmpty = hosts.filter((h) => h.trim() !== "");

    const currEmail = session?.data?.user?.email;
    if (currEmail && !hostsNoEmpty.includes(currEmail)) {
      hostsNoEmpty.unshift(currEmail);
    }

    const json = {
      name: title,
      location: `${address}, ${city}, ${state}, ${zipCode}`,
      startTimestamp: startingTime.toISOString(),
      duration: `${duration} minutes`,
      description: description,
      visibility:
        visibility === "public"
          ? EventVisibility.Public
          : EventVisibility.Member,
      ...(eventCapacity != "" && {
        rsvpLimit: Math.max(1, parseInt(eventCapacity, 10)),
      }),
      ...(deadline != "" && { rsvpDeadline: deadline }),
      ...(notes != "" && { accessibilityNotes: notes }),
      ...(linksNoEmpty.length > 0 && { links: linksNoEmpty }),
      ...(hostsNoEmpty.length > 0 && { hosts: hostsNoEmpty }),
    };

    try {
      const response = await api.events.$post({
        json: json,
      });

      if (!response.ok) {
        setHasError(true);
        const data = (await response.json()) as { error?: string };
        const message =
          data.error || "An error occurred while creating the event.";
        setErrorMessage(message);
        return;
      }

      const data = await response.json();
      router.push(`/events/${data.id}`);
    } catch (error) {
      setHasError(true);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
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
            <ExitIcon />
          </BogButton>
        </div>
        <div className="w-full">
          <hr className="w-full border-[var(--color-media-divider)]" />
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
            <div className="w-2/5">
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
            <div className="w-1/5">
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
            <div className="w-1/5">
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
            <div className="w-2/5">
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
            <div className="w-1/5">
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
            <div className="w-1/5">
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
            <div className="w-1/5">
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
              className="w-1/5"
            />
            <BogTextInput
              name="deadline"
              label="Registration Deadline"
              type="date"
              placeholder="Enter a date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-1/5"
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
              <PlusIcon />
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
              <PlusIcon />
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
            <WarningIcon />
            <p>Please fill out all required fields</p>
          </div>
        )}
        {wrongTime && (
          <div className="w-full flex flex-row items-center p-4 gap-2 self-stretch rounded bg-[var(--color-brand-stroke-weak)] min-h-[40px]">
            <WarningIcon />
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
          <div className="flex w-2/5 p-8 flex-col items-center gap-4 bg-white rounded">
            <div className="h-[68.717px] self-stretch">
              <div className="w-full">
                <div className="inline-flex w-full justify-between items-center">
                  <h4>Discard changes</h4>
                  <BogButton
                    onClick={() => setExit(false)}
                    className="bg-transparent"
                  >
                    <ExitIcon />
                  </BogButton>
                </div>
                <hr className="w-full border-[var(--color-media-divider)]" />
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
          <div className="flex w-2/5 p-8 flex-col items-center gap-4 bg-white rounded">
            <div className="h-[68.717px] self-stretch">
              <div className="w-full">
                <div className="inline-flex w-full justify-between items-center">
                  <h4>Event not created</h4>
                  <BogButton
                    onClick={() => setHasError(false)}
                    className="bg-transparent"
                  >
                    <ExitIcon />
                  </BogButton>
                </div>
                <hr className="w-full border-[var(--color-media-divider)]" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-12 self-stretch ">
              <div className="flex flex-col items-start gap-12 self-stretch">
                <p className="self-stretch">
                  {errorMessage !== ""
                    ? errorMessage
                    : "An error occurred while creating the event."}
                </p>
              </div>
              <div className="flex items-start gap-5">
                <BogButton
                  onClick={() => setHasError(false)}
                  className="flex py-2 px-3 items-center -gap-1"
                >
                  Close
                </BogButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
