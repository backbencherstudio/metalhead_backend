import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from 'class-validator';

export function IsLocationOrCoordinates(validationOptions?: ValidationOptions) {
    return function (constructor: Function) {
        registerDecorator({
            name: 'IsLocationOrCoordinates',
            target: constructor,
            propertyName: undefined, // class-level decorator
            options: validationOptions,
            validator: {
                validate(_: any, args: ValidationArguments) {
                    const obj = args.object as any;
                    const hasLocation = !!obj.location;
                    const hasCoordinates =
                        obj.latitude !== undefined &&
                        obj.latitude !== null &&
                        obj.longitude !== undefined &&
                        obj.longitude !== null;

                    return hasLocation || hasCoordinates;
                },
                defaultMessage() {
                    return `Either 'location' or both 'latitude' and 'longitude' must be provided`;
                },
            },
        });
    };
}
